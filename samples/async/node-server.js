var http = require("http");
var fs = require("fs");
var url = require("url");
var path = require("path");

process.compile(fs.readFileSync("../src/narcissus.js"), "narcissus.js");
process.compile(fs.readFileSync("../src/jscex.js"), "jscex.js");
process.compile(fs.readFileSync("../src/jscex.async.js"), "jscex.async.js");
process.compile(fs.readFileSync("../src/jscex.async.node.js"), "jscex.async.node.js");

var transferFile = function(request, response) {
    var uri = url.parse(request.url).pathname;
    var filepath = path.join(process.cwd(), uri);

    path.exists(filepath, function(exists) {
        if (!exists) {
            response.writeHead(404, {"Content-Type": "text/plain"});
            response.write("404 Not Found\n");
            response.end();
        } else {
            fs.readFile(filepath, "binary", function(error, data) {
                if (error) {
                    response.writeHead(500, {"Content-Type": "text/plain"});
                    response.write(error + "\n");
                } else {
                    response.writeHead(200);
                    response.write(data, "binary");
                }

                response.end();
            });
        }
    });
}

http.createServer(function(request, response) {
    transferFile(request, response);
}).listen(8124, "127.0.0.1");


//////////////////////////////////////////////////////////

Jscex.Async.Node.Path.extend(path);
Jscex.Async.Node.FileSystem.extend(fs);

var transferFileAsync = eval(Jscex.compile("$async", function(request, response) {
    var uri = url.parse(request.url).pathname;
    var filepath = path.join(process.cwd(), uri);

    var exists = $await(path.existsAsync(filepath));
    if (!exists) {
        response.writeHead(404, {"Content-Type": "text/plain"});
        response.write("404 Not Found\n");
    } else {
        var file = $await(fs.readFileAsync(filepath));
        if (file.error) {
            response.writeHead(500, {"Content-Type": "text/plain"});
            response.write(file.error + "\n");
        } else {
            response.writeHead(200);
            response.write(file.data, "binary");
        }
    }

    response.end();
}));

http.createServer(function(request, response) {
    Jscex.Async.start(transferFileAsync(request, response));
}).listen(8125, "127.0.0.1");
