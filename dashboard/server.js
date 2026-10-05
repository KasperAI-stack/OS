/* HeyOtto OS — lokal server.

   Kun til for at dashboardet kan gemme lydløst. Åbnet som ren fil virker
   dashboardet også, men skal spørge om lov til at skrive én gang pr. session.

   Lytter udelukkende på 127.0.0.1, så den aldrig er tilgængelig fra netværket.
   Start med: node server.js  (eller dobbeltklik start-dashboard.cmd) */

var http = require("http");
var fs = require("fs");
var path = require("path");

var DIR = __dirname;
var PORT = Number(process.env.PORT) || 7777;
var DATA_FILE = "marketing-os-data.js";

var TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon"
};

function save(req, res) {
  var body = "";
  req.setEncoding("utf8");
  req.on("data", function (c) {
    body += c;
    if (body.length > 8e6) { req.destroy(); }      // ingen grund til at tage imod mere
  });
  req.on("end", function () {
    // Sikkerhedsnet: skriv kun hvis det faktisk ligner datafilen. Det
    // forhindrer, at en halv eller forkert body overskriver alt indholdet.
    if (!/var\s+DATA\s*=\s*\{/.test(body) || !/tasks\s*:\s*\[/.test(body)) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Indholdet ligner ikke datafilen — intet skrevet.");
    }
    var target = path.join(DIR, DATA_FILE);
    try {
      // Skriv først til en midlertidig fil og byt om, så filen aldrig
      // kan ende halvskrevet, hvis noget går galt undervejs.
      var tmp = target + ".tmp";
      fs.writeFileSync(tmp, body, "utf8");
      fs.renameSync(tmp, target);
      var stamp = new Date().toLocaleTimeString("da-DK");
      console.log("  " + stamp + "  gemt — " + body.length + " tegn");
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
    } catch (e) {
      console.error("  kunne ikke skrive:", e.message);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Kunne ikke skrive filen: " + e.message);
    }
  });
}

function serve(req, res) {
  var rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/marketing-os.html";
  var file = path.join(DIR, path.normalize(rel).replace(/^[\\/]+/, ""));
  if (file.indexOf(DIR) !== 0) {                    // ingen vej ud af mappen
    res.writeHead(403); return res.end("nej");
  }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("ikke fundet"); }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"                   // ellers ser man sin egen gamle data
    });
    res.end(data);
  });
}

var server = http.createServer(function (req, res) {
  if (req.method === "POST" && req.url.replace(/^\//, "") === "save") return save(req, res);
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  serve(req, res);
});

server.on("error", function (e) {
  if (e.code === "EADDRINUSE") {
    console.error("\n  Port " + PORT + " er optaget.");
    console.error("  Kører HeyOtto OS allerede i et andet vindue? Åbn http://localhost:" + PORT);
    console.error("  Ellers: sæt en anden port med   set PORT=7788 && node server.js\n");
  } else {
    console.error("\n  Serveren kunne ikke starte: " + e.message + "\n");
  }
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", function () {
  var url = "http://localhost:" + PORT;
  console.log("\n  HeyOtto OS kører på " + url);
  console.log("  Skriver til " + DATA_FILE + " i denne mappe.");
  console.log("  Luk vinduet eller tryk Ctrl+C for at stoppe.\n");
  if (process.env.MOS_NO_OPEN) return;              // bruges ved test
  try {
    require("child_process").exec('start "" "' + url + '"');
  } catch (e) {
    console.log("  (kunne ikke åbne browseren selv — åbn " + url + " manuelt)");
  }
});
