var http = require("http");
var fs = require("fs");
var url = require("url");
var path = require("path");

var transferFile = function (request, response) {
    var uri = url.parse(request.url).pathname;
    var filepath = path.join(process.cwd(), uri);

    // check whether the file is exist and get the result from callback
    path.exists(filepath, function (exists) {
        if (!exists) {
            response.writeHead(404, {"Content-Type": "text/plain"});
            response.write("404 Not Found\n");
            response.end();
        } else {
            // read the file content and get the result from callback
            fs.readFile(filepath, "binary", function (error, data) {
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

var Jscex = require("../../src/jscex");
require("../../src/jscex-jit").init(Jscex);
require("../../src/jscex-async").init(Jscex);
require("../../src/jscex-async-powerpack").init(Jscex);

path.existsAsync = Jscex.Async.Jscexify.fromCallback(path.exists);
fs.readFileAsync = Jscex.Async.Jscexify.fromStandard(fs.readFile);

var transferFileAsync = eval(Jscex.compile("async", function (request, response) {
    var uri = url.parse(request.url).pathname;
    var filepath = path.join(process.cwd(), uri);

    var exists = $await(path.existsAsync(filepath));
    if (!exists) {
        response.writeHead(404, {"Content-Type": "text/plain"});
        response.write("404 Not Found\n");
    } else {
        try {
            var data = $await(fs.readFileAsync(filepath));
            response.writeHead(200);
            response.write(data, "binary");
        } catch (ex) {
            response.writeHead(500, {"Content-Type": "text/plain"});
            response.write(ex + "\n");
        }
    }

    response.end();
}));

http.createServer(function (request, response) {
    transferFileAsync(request, response).start();
}).listen(8125, "127.0.0.1");
