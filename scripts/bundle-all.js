var path = require("path"),
    fs = require("fs");

var srcDir = path.join(__dirname, "..", "src");

var buffer = [];

buffer.push("/*******************************************************************");
buffer.push(" * This file is designed to write Jscex code in debug mode.");
buffer.push("");
buffer.push(" * The file is a bundle of:");
buffer.push(" * 1. jscex.js");
buffer.push(" * 2. jscex-parser.js");
buffer.push(" * 3. jscex-jit.js");
buffer.push(" * 4. jscex-builderbase.js");
buffer.push(" * 5. jscex-async.js");
buffer.push(" * 6. jscex-async-powerpack.js");
buffer.push(" *******************************************************************/");
buffer.push("");
buffer.push("// jscex.js")
buffer.push(fs.readFileSync(path.join(srcDir, "jscex.js")));
buffer.push("");
buffer.push("// jscex-parser.js")
buffer.push(fs.readFileSync(path.join(srcDir, "jscex-parser.js")));
buffer.push("");
buffer.push("// jscex-jit.js");
buffer.push(fs.readFileSync(path.join(srcDir, "jscex-jit.js")));
buffer.push("");
buffer.push("// jscex-builderbase.js");
buffer.push(fs.readFileSync(path.join(srcDir, "jscex-builderbase.js")));
buffer.push("");
buffer.push("// jscex-async.js");
buffer.push(fs.readFileSync(path.join(srcDir, "jscex-async.js")));
buffer.push("");
buffer.push("// jscex-async-powerpack.js");
buffer.push(fs.readFileSync(path.join(srcDir, "jscex-async-powerpack.js")));

var targetPath = path.join(__dirname, "..", "bin", "jscex.bundle.js");
fs.writeFileSync(targetPath, buffer.join("\r\n"), "utf8");
