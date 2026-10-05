#!/usr/bin/env python3
"""Owner Telegram console.

Security model:
- explicit owner user id AND admin chat id;
- read-only diagnostics execute immediately;
- free-form text/voice becomes a persisted mission;
- no arbitrary shell command is ever executed from Telegram;
- sensitive missions are explicitly marked confirmation_required.
"""
import base64
import datetime
import fcntl
import json
import os
import pathlib
import re
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from tlm_guardian import DATA, config, clean, summary

COMMANDS = {
    '/status', '/live', '/analyses', '/signaux', '/shadow',
    '/telegram', '/budget', '/disk', '/audit', '/mission', '/help', '/whoami'
}
READ_FIELDS = {
    '/live': ('football', 'live_count', 'unexplained_pending', 'goal05'),
    '/analyses': ('analyses', 'votes', 'attempts', 'jev'),
    '/signaux': ('official', 'results'),
    '/shadow': ('shadow',),
    '/telegram': ('telegram', 'incidents'),
    '/budget': ('budget', 'provider_blocks'),
    '/disk': ('disk_percent',),
}
MAX_VOICE_BYTES = 10 * 1024 * 1024
MAX_VOICE_SECONDS = 180


def authorized(message, env):
    user = env.get('TELEGRAM_ADMIN_USER_ID', '')
    chat = env.get('TELEGRAM_ADMIN_CHAT_ID', '')
    return bool(
        user and chat
        and str(message.get('from', {}).get('id')) == user
        and str(message.get('chat', {}).get('id')) == chat
        and not message.get('from', {}).get('is_bot')
        and not message.get('forward_origin')
        and not message.get('sender_chat')
    )


def bootstrap_whoami(message, env):
    """Allow identity discovery in the configured admin chat, never actions."""
    if env.get('TELEGRAM_ADMIN_USER_ID'):
        return False
    chat = env.get('TELEGRAM_ADMIN_CHAT_ID', '')
    text = str(message.get('text', '')).strip().split('@')[0]
    return bool(
        chat
        and str(message.get('chat', {}).get('id')) == chat
        and text == '/whoami'
        and not message.get('from', {}).get('is_bot')
        and not message.get('forward_origin')
        and not message.get('sender_chat')
    )


def should_process_update(message, authorized_ok, bootstrap_ok, offsetfile_exists):
    """Execute only authorized updates once a persistent Telegram offset exists.

    On normal restarts, any update returned by getUpdates is unacknowledged and
    must be retried regardless of message age. On first-ever activation (no
    offset file yet), queued historical updates are acknowledged without action
    so old commands cannot suddenly execute.
    """
    if not offsetfile_exists:
        return False
    return bool(authorized_ok or bootstrap_ok)


def normalize(value):
    value = unicodedata.normalize('NFKD', str(value or ''))
    value = ''.join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r'\s+', ' ', value.lower()).strip()


def read_intent(text):
    value = normalize(text)
    intents = (
        ('/status', ('statut', 'status', 'etat general', 'tout fonctionne', 'production')),
        ('/live', ('live', 'direct', 'matchs en cours')),
        ('/analyses', ('analyse', 'analyses', 'votes ia', 'vote ia', 'concile')),
        ('/signaux', ('signal', 'signaux', 'selection envoyee', 'selections envoyees')),
        ('/telegram', ('telegram', 'livraison telegram', 'envoi telegram')),
        ('/budget', ('budget', 'cout ia', 'depense ia', 'openrouter')),
        ('/disk', ('disque', 'espace disque', 'stockage vps')),
        ('/shadow', ('shadow', 'test a blanc', 'tests a blanc')),
    )
    for command, phrases in intents:
        if any(phrase in value for phrase in phrases):
            return command
    return None


def mission_risk(text):
    value = normalize(text)
    red = (
        'virement', 'banque', 'payer', 'paiement', 'carte bancaire',
        'supprime', 'efface', 'rm -rf', 'mot de passe', 'password',
        'cle api', 'token', 'secret', 'stripe', 'revoque',
        'change la strategie', 'change les regles', 'baisse le seuil',
        'deploy destructif', 'reset --hard', 'revert'
    )
    orange = (
        'deploy', 'deploie', 'redemarre', 'restart', 'modifie',
        'corrige', 'repare', 'envoie un email', 'envoie le mail',
        'cree un rendez-vous', 'annule', 'archive'
    )
    if any(term in value for term in red):
        return 'confirmation_required'
    if any(term in value for term in orange):
        return 'review_required'
    return 'review_required'


def persist_mission(task, message, inbox, source='text', transcript=None):
    inbox.mkdir(mode=0o700, parents=True, exist_ok=True)
    message_id = str(message.get('message_id', 'unknown'))
    path = inbox / (message_id + '.json')
    risk = mission_risk(task)
    automatic = risk != 'confirmation_required'
    payload = {
        'received_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'task': clean(task),
        'source': source,
        'transcript': clean(transcript) if transcript else None,
        'risk': risk,
        'status': 'pending_execution' if automatic else 'awaiting_confirmation',
        'automatic_execution': automatic,
        'runner_version': 1,
        'message_id': message.get('message_id'),
        'owner_user_id': str(message.get('from', {}).get('id', '')),
        'chat_id': str(message.get('chat', {}).get('id', '')),
    }
    if not path.exists():
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
        os.chmod(path, 0o600)
    return payload


def read_answer(command, state):
    if command in ('/status', '/audit'):
        return summary(state)
    fields = READ_FIELDS[command]
    return clean(json.dumps({key: state.get(key) for key in fields}, ensure_ascii=False, indent=2))


def handle_text(text, message, env, state, inbox, source='text'):
    raw = str(text or '').strip()
    if not raw:
        return 'Je n’ai reçu aucune instruction exploitable.'

    parts = raw.split(None, 1)
    first = parts[0].split('@')[0] if parts else ''

    if first.startswith('/'):
        if first not in COMMANDS:
            return 'Commande refusée. Utilise /help ou parle-moi normalement.'
        if first == '/whoami':
            return 'ID utilisateur autorisé : ' + str(message.get('from', {}).get('id', 'inconnu'))
        if first == '/help':
            return (
                'Lecture : /status /live /analyses /signaux /shadow /telegram /budget /disk /audit.\n'
                'Mission : /mission texte.\n'
                'Tu peux aussi écrire ou dicter une demande en français.'
            )
        if first == '/mission':
            if len(parts) < 2:
                return 'Utilise /mission suivi de la demande.'
            payload = persist_mission(parts[1], message, inbox, source=source, transcript=text if source == 'voice' else None)
            return ('Mission transmise à Codex.' if payload['automatic_execution'] else 'Mission enregistrée. Confirmation obligatoire avant exécution.') + ' Risque : ' + payload['risk'] + '.'
        return read_answer(first, state)

    intent = read_intent(raw)
    if intent:
        return read_answer(intent, state)

    payload = persist_mission(raw, message, inbox, source=source, transcript=text if source == 'voice' else None)
    if payload['automatic_execution']:
        return (
            'Mission transmise à Codex depuis ' + ('la voix' if source == 'voice' else 'le texte')
            + '. Risque : ' + payload['risk']
            + '. Exécution isolée et traçable en cours.'
        )
    return (
        'Mission enregistrée depuis ' + ('la voix' if source == 'voice' else 'le texte')
        + '. Risque : ' + payload['risk']
        + '. Confirmation obligatoire avant toute exécution.'
    )


def handle(message, env, state, inbox):
    if not authorized(message, env):
        return None
    return handle_text(message.get('text', ''), message, env, state, inbox)


def telegram_request(token, method, payload):
    req = urllib.request.Request(
        'https://api.telegram.org/bot' + token + '/' + method,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=35) as response:
        return json.load(response)


def telegram_file(token, file_id):
    meta = telegram_request(token, 'getFile', {'file_id': file_id})
    if not meta.get('ok') or not meta.get('result', {}).get('file_path'):
        raise RuntimeError('telegram_file_unavailable')
    path = meta['result']['file_path']
    url = 'https://api.telegram.org/file/bot' + token + '/' + path
    with urllib.request.urlopen(url, timeout=35) as response:
        data = response.read(MAX_VOICE_BYTES + 1)
    if len(data) > MAX_VOICE_BYTES:
        raise RuntimeError('voice_too_large')
    suffix = pathlib.Path(path).suffix or '.ogg'
    return data, suffix


def audio_mime_from_suffix(suffix):
    value = str(suffix or '').lower()
    if value in ('.ogg', '.oga'):
        return 'audio/ogg'
    if value == '.opus':
        return 'audio/opus'
    if value in ('.m4a', '.mp4'):
        return 'audio/m4a'
    if value == '.mp3':
        return 'audio/mp3'
    if value == '.wav':
        return 'audio/wav'
    return 'application/octet-stream'


def multipart(fields, file_name, file_bytes, file_type='audio/ogg'):
    boundary = '----tlm-hermes-' + str(int(time.time() * 1000))
    chunks = []
    for name, value in fields.items():
        chunks.append(('--' + boundary + '\r\n').encode())
        chunks.append(('Content-Disposition: form-data; name="' + name + '"\r\n\r\n').encode())
        chunks.append(str(value).encode())
        chunks.append(b'\r\n')
    chunks.append(('--' + boundary + '\r\n').encode())
    chunks.append(('Content-Disposition: form-data; name="file"; filename="' + file_name + '"\r\n').encode())
    chunks.append(('Content-Type: ' + file_type + '\r\n\r\n').encode())
    chunks.append(file_bytes)
    chunks.append(b'\r\n')
    chunks.append(('--' + boundary + '--\r\n').encode())
    return boundary, b''.join(chunks)


def _transcribe_http(audio, suffix, endpoint, api_key, model):
    boundary, body = multipart(
        {'model': model, 'response_format': 'json', 'language': 'fr'},
        'telegram-voice' + suffix,
        audio,
        audio_mime_from_suffix(suffix),
    )
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            'Authorization': 'Bearer ' + api_key,
            'Content-Type': 'multipart/form-data; boundary=' + boundary,
        },
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = json.load(response)
    transcript = str(payload.get('text') or '').strip()
    if not transcript:
        raise RuntimeError('empty_transcript')
    return transcript


def _transcribe_gemini(audio, suffix, api_key, model):
    mime = audio_mime_from_suffix(suffix)
    payload = {
        'contents': [{
            'role': 'user',
            'parts': [
                {'text': 'Transcris fidèlement ce message vocal en français. Réponds uniquement avec la transcription, sans commentaire.'},
                {'inlineData': {'mimeType': mime, 'data': base64.b64encode(audio).decode('ascii')}},
            ],
        }],
        'generationConfig': {'temperature': 0},
    }
    url = (
        'https://generativelanguage.googleapis.com/v1beta/models/'
        + model + ':generateContent?key=' + urllib.parse.quote(api_key, safe='')
    )
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        data = json.load(response)
    parts = (((data.get('candidates') or [{}])[0].get('content') or {}).get('parts') or [])
    transcript = ' '.join(str(part.get('text') or '').strip() for part in parts if part.get('text')).strip()
    if not transcript:
        raise RuntimeError('empty_transcript')
    return transcript


def transcribe_voice(message, env, token):
    voice = message.get('voice') or message.get('audio') or {}
    duration = int(voice.get('duration') or 0)
    size = int(voice.get('file_size') or 0)
    if duration and duration > MAX_VOICE_SECONDS:
        raise RuntimeError('voice_too_long')
    if size and size > MAX_VOICE_BYTES:
        raise RuntimeError('voice_too_large')
    file_id = voice.get('file_id')
    if not file_id:
        raise RuntimeError('voice_missing_file')

    audio, suffix = telegram_file(token, file_id)
    errors = []

    google_key = env.get('GOOGLE_API_KEY', '')
    if google_key:
        configured = env.get('HERMES_GEMINI_TRANSCRIPTION_MODEL', 'gemini-3.5-flash-lite')
        google_models = []
        for model in (configured, 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'):
            if model and model not in google_models:
                google_models.append(model)
        transient = {429, 500, 502, 503, 504}
        for model in google_models:
            for attempt in range(2):
                try:
                    return _transcribe_gemini(audio, suffix, google_key, model)
                except urllib.error.HTTPError as error:
                    errors.append('google_' + model + '_http_' + str(error.code))
                    if error.code in transient and attempt == 0:
                        time.sleep(1.5)
                        continue
                    break
                except Exception as error:
                    errors.append('google_' + model + '_' + type(error).__name__)
                    break

    openai_key = env.get('OPENAI_API_KEY', '')
    if openai_key:
        try:
            return _transcribe_http(
                audio,
                suffix,
                'https://api.openai.com/v1/audio/transcriptions',
                openai_key,
                env.get('HERMES_TRANSCRIPTION_MODEL', 'gpt-4o-mini-transcribe'),
            )
        except urllib.error.HTTPError as error:
            errors.append('openai_http_' + str(error.code))
        except Exception as error:
            errors.append('openai_' + type(error).__name__)

    groq_key = env.get('GROQ_API_KEY', '')
    if groq_key:
        try:
            return _transcribe_http(
                audio,
                suffix,
                'https://api.groq.com/openai/v1/audio/transcriptions',
                groq_key,
                env.get('HERMES_GROQ_TRANSCRIPTION_MODEL', 'whisper-large-v3-turbo'),
            )
        except urllib.error.HTTPError as error:
            errors.append('groq_http_' + str(error.code))
        except Exception as error:
            errors.append('groq_' + type(error).__name__)

    if not google_key and not openai_key and not groq_key:
        raise RuntimeError('transcription_not_configured')
    raise RuntimeError('transcription_failed_' + '_'.join(errors))


def audit_event(audit, payload):
    payload = dict(payload)
    payload.setdefault('at', datetime.datetime.now(datetime.timezone.utc).isoformat())
    with audit.open('a') as stream:
        stream.write(json.dumps(payload, ensure_ascii=False) + '\n')


def safe_state():
    try:
        return json.loads((DATA / 'hermes_guardian_state.json').read_text())
    except Exception:
        return {'incidents': [{'type': 'guardian_state_unavailable'}]}


def main():
    env = config()
    token = env.get('HERMES_ADMIN_TLM_BOT')
    if not token or not env.get('TELEGRAM_ADMIN_CHAT_ID'):
        raise SystemExit('Activation refusée : token et chat admin requis.')

    lock = open(DATA / 'owner_remote.lock', 'a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return

    offsetfile = DATA / 'owner_remote_offset.json'
    offsetfile_exists = offsetfile.exists()
    offset = json.loads(offsetfile.read_text()).get('offset', 0) if offsetfile_exists else 0
    audit = DATA / 'owner_remote_commands.jsonl'
    inbox = DATA / 'owner_missions'

    while True:
        try:
            result = telegram_request(token, 'getUpdates', {
                'offset': offset,
                'timeout': 25,
                'allowed_updates': ['message'],
            })
            if not result.get('ok'):
                time.sleep(10)
                continue

            for update in result.get('result', []):
                message = update.get('message', {})
                ok = authorized(message, env)
                bootstrap = bootstrap_whoami(message, env)
                source = 'voice' if (message.get('voice') or message.get('audio')) else 'text'
                raw_command = message.get('text', '').split(' ', 1)[0].split('@')[0]
                event = {
                    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'update_id': update.get('update_id'),
                    'authorized': ok,
                    'bootstrap': bootstrap,
                    'source': source,
                    'command': raw_command if raw_command in COMMANDS else ('natural' if ok else 'unknown'),
                }
                audit_event(audit, event)

                if bootstrap and should_process_update(message, ok, bootstrap, offsetfile_exists):
                    telegram_request(token, 'sendMessage', {
                        'chat_id': env['TELEGRAM_ADMIN_CHAT_ID'],
                        'text': (
                            'Ton Telegram user ID est ' + str(message.get('from', {}).get('id', ''))
                            + '. Ajoute TELEGRAM_ADMIN_USER_ID avec cette valeur dans le .env puis redémarre tlm-owner-remote.'
                        ),
                    })
                elif ok and should_process_update(message, ok, bootstrap, offsetfile_exists):
                    state = safe_state()
                    transcript = None
                    processing_error = None
                    try:
                        if source == 'voice':
                            transcript = transcribe_voice(message, env, token)
                            answer = '🎙️ « ' + clean(transcript) + ' »\n\n' + handle_text(
                                transcript, message, env, state, inbox, source='voice'
                            )
                        else:
                            answer = handle(message, env, state, inbox)
                    except Exception as error:
                        processing_error = clean(str(error)) or type(error).__name__
                        answer = 'Commande reçue mais non traitée : ' + processing_error
                    if answer:
                        sent = telegram_request(token, 'sendMessage', {
                            'chat_id': env['TELEGRAM_ADMIN_CHAT_ID'],
                            'text': clean(answer),
                        })
                        reply_id = sent.get('result', {}).get('message_id') if sent.get('ok') else None
                        result_event = {
                            'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                            'update_id': update.get('update_id'),
                            'phase': 'result',
                            'authorized': True,
                            'source': source,
                            'outcome': 'replied' if reply_id else 'reply_failed',
                            'reply_message_id': reply_id,
                        }
                        if source == 'voice':
                            result_event['transcription_ok'] = bool(transcript)
                            result_event['transcription_error'] = processing_error
                            result_event['intent'] = (read_intent(transcript) or 'mission') if transcript else None
                        audit_event(audit, result_event)

                offset = update.get('update_id', offset) + 1
                offsetfile.write_text(json.dumps({'offset': offset}))
                offsetfile_exists = True
        except Exception as error:
            try:
                audit_event(audit, {
                    'phase': 'loop_error',
                    'outcome': 'exception',
                    'error_type': type(error).__name__,
                    'error': clean(str(error))[:500],
                    'offset': offset,
                })
            except Exception:
                pass
            time.sleep(10)


if __name__ == '__main__':
    main()


# voice-proof-refresh 2026-10-05 14:43 CEST

# voice-proof-refresh 2026-10-05 14:55 CEST

# final-voice-proof-trigger 2026-10-05T14:54+02:00

# voice-proof 2026-10-05T15:08+02:00
