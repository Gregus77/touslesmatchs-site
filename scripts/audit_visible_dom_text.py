#!/usr/bin/env python3
"""Extract rendered text from Chrome's --dump-dom output for translation audits."""
import sys
from html.parser import HTMLParser


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() in ("script", "style", "noscript", "template"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag.lower() in ("script", "style", "noscript", "template") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip and data.strip():
            self.parts.append(data.strip())


if len(sys.argv) != 3:
    raise SystemExit("usage: audit_visible_dom_text.py INPUT_HTML OUTPUT_TEXT")

parser = VisibleText()
with open(sys.argv[1], encoding="utf-8") as source:
    parser.feed(source.read())
with open(sys.argv[2], "w", encoding="utf-8") as output:
    output.write("\n".join(parser.parts))
