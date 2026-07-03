import React from "react";

/**
 * Globe — Terre 3D animée, 100% canvas (aucune dépendance lourde).
 * Wireframe sphérique en rotation lente + "stades" illuminés + flux de données
 * (arcs lumineux) + particules IA. Optimisé mobile : compte de points modéré,
 * devicePixelRatio plafonné, pause quand l'onglet est masqué, respect de
 * prefers-reduced-motion.
 *
 * Palette : vert néon (#00e676) dominant + touches or (#d4af37).
 */
export default function Globe() {
  var canvasRef = React.useRef(null);

  React.useEffect(function () {
    var canvas = canvasRef.current;
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var raf = 0;
    var running = true;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;

    function resize() {
      var parent = canvas.parentElement;
      var w = parent ? parent.clientWidth : window.innerWidth;
      var h = parent ? parent.clientHeight : window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = w; H = h;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      // Globe légèrement en bas pour un effet "planète qui se lève"
      cy = h * (w < 640 ? 0.52 : 0.5);
      R = Math.min(w, h) * (w < 640 ? 0.42 : 0.38);
    }

    // --- Géométrie sphère ---
    function project(lat, lon, rot) {
      // lat [-90,90], lon [-180,180]
      var la = (lat * Math.PI) / 180;
      var lo = (lon * Math.PI) / 180 + rot;
      var x = Math.cos(la) * Math.sin(lo);
      var y = Math.sin(la);
      var z = Math.cos(la) * Math.cos(lo);
      return { x: cx + x * R, y: cy - y * R, z: z };
    }

    // "Stades" (villes) illuminés — positions approximatives de grands hubs
    var cities = [
      [48.8, 2.3], [51.5, -0.1], [40.4, -3.7], [41.9, 12.5], [52.5, 13.4],
      [40.7, -74.0], [34.0, -118.2], [-23.5, -46.6], [-34.6, -58.4], [35.7, 139.7],
      [55.7, 37.6], [30.0, 31.2], [-26.2, 28.0], [19.4, -99.1], [1.35, 103.8], [25.2, 55.3],
    ];

    // Flux de données entre villes
    var arcs = [];
    function spawnArc() {
      var a = cities[(Math.random() * cities.length) | 0];
      var b = cities[(Math.random() * cities.length) | 0];
      if (a === b) return;
      arcs.push({ a: a, b: b, t: 0, speed: 0.006 + Math.random() * 0.01, gold: Math.random() < 0.25 });
    }
    for (var i = 0; i < 5; i++) spawnArc();

    // Particules IA autour du globe
    var particles = [];
    for (var p = 0; p < 42; p++) {
      particles.push({
        ang: Math.random() * Math.PI * 2,
        rad: 1.05 + Math.random() * 0.35,
        speed: 0.001 + Math.random() * 0.003,
        size: 0.6 + Math.random() * 1.6,
        gold: Math.random() < 0.2,
      });
    }

    function slerpPoint(a, b, t, rot) {
      // interpolation simple lat/lon (suffisant visuellement)
      var lat = a[0] + (b[0] - a[0]) * t;
      var lon = a[1] + (b[1] - a[1]) * t;
      // léger arc "en altitude"
      var lift = Math.sin(t * Math.PI) * 0.18;
      var pt = project(lat, lon, rot);
      return { x: pt.x, y: pt.y - lift * R * 0.15, z: pt.z };
    }

    var rot = 0;

    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);

      // Halo atmosphère
      var glow = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.35);
      glow.addColorStop(0, "rgba(0,230,118,0.10)");
      glow.addColorStop(0.6, "rgba(0,230,118,0.04)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Disque sombre du globe
      var body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R);
      body.addColorStop(0, "rgba(10,26,20,0.9)");
      body.addColorStop(1, "rgba(4,8,10,0.95)");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Méridiens & parallèles (wireframe front-hemisphere)
      ctx.lineWidth = 1;
      var lon, lat, first, pt, prev;
      // Méridiens
      for (lon = -180; lon < 180; lon += 30) {
        prev = null;
        for (lat = -90; lat <= 90; lat += 6) {
          pt = project(lat, lon, rot);
          if (pt.z > 0) {
            if (prev) {
              ctx.strokeStyle = "rgba(0,230,118," + (0.05 + pt.z * 0.18).toFixed(3) + ")";
              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(pt.x, pt.y);
              ctx.stroke();
            }
            prev = pt;
          } else prev = null;
        }
      }
      // Parallèles
      for (lat = -60; lat <= 60; lat += 30) {
        prev = null; first = null;
        for (lon = -180; lon <= 180; lon += 8) {
          pt = project(lat, lon, rot);
          if (pt.z > 0) {
            if (prev) {
              ctx.strokeStyle = "rgba(0,230,118," + (0.04 + pt.z * 0.14).toFixed(3) + ")";
              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(pt.x, pt.y);
              ctx.stroke();
            }
            prev = pt;
          } else prev = null;
        }
      }

      // Stades illuminés
      for (i = 0; i < cities.length; i++) {
        pt = project(cities[i][0], cities[i][1], rot);
        if (pt.z > 0.02) {
          var pulse = 0.6 + 0.4 * Math.sin(rot * 6 + i);
          var rr = (1.4 + pulse * 1.6) * (0.5 + pt.z * 0.5);
          var gold = i % 5 === 0;
          var col = gold ? "212,175,55" : "0,230,118";
          ctx.fillStyle = "rgba(" + col + "," + (0.5 * pt.z + 0.3).toFixed(2) + ")";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, rr, 0, Math.PI * 2);
          ctx.fill();
          // halo
          ctx.fillStyle = "rgba(" + col + "," + (0.12 * pt.z).toFixed(2) + ")";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, rr * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Flux de données
      for (i = arcs.length - 1; i >= 0; i--) {
        var arc = arcs[i];
        arc.t += arc.speed;
        if (arc.t >= 1) { arcs.splice(i, 1); continue; }
        var steps = 22;
        var col2 = arc.gold ? "212,175,55" : "0,230,118";
        prev = null;
        for (var s = 0; s <= steps; s++) {
          var tt = (s / steps) * arc.t;
          var sp = slerpPoint(arc.a, arc.b, tt, rot);
          if (sp.z > 0) {
            if (prev) {
              var headFade = s / steps;
              ctx.strokeStyle = "rgba(" + col2 + "," + (0.15 + headFade * 0.55).toFixed(3) + ")";
              ctx.lineWidth = 1 + headFade * 1.2;
              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(sp.x, sp.y);
              ctx.stroke();
            }
            prev = sp;
          } else prev = null;
        }
        // tête lumineuse
        var head = slerpPoint(arc.a, arc.b, arc.t, rot);
        if (head.z > 0) {
          ctx.fillStyle = "rgba(" + col2 + ",0.9)";
          ctx.beginPath();
          ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (arcs.length < 6 && Math.random() < 0.03) spawnArc();

      // Particules IA
      for (i = 0; i < particles.length; i++) {
        var pa = particles[i];
        pa.ang += pa.speed;
        var px = cx + Math.cos(pa.ang) * R * pa.rad;
        var py = cy + Math.sin(pa.ang) * R * pa.rad * 0.55;
        ctx.fillStyle = pa.gold ? "rgba(212,175,55,0.5)" : "rgba(0,230,118,0.45)";
        ctx.beginPath();
        ctx.arc(px, py, pa.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Liseré néon du limbe
      ctx.strokeStyle = "rgba(0,230,118,0.35)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      rot += reduce ? 0.0008 : 0.0022;
      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    function onVis() {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; draw(); }
    }
    document.addEventListener("visibilitychange", onVis);
    draw();

    return function () {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return React.createElement("canvas", {
    ref: canvasRef,
    "aria-hidden": "true",
    style: { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" },
  });
}
