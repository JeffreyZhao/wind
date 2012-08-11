var http = require("http");
var fs = require("fs");
var url = require("url");
var path = require("path");

var transferFile = function (request, response) {
    var uri = url.parse(request.url).pathname;
    var filepath = path.join(process.cwd(), uri);

    // check whether the file is exist and get the result from callback
    fs.exists(filepath, function (exists) {
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


/***********************************************************************
  The Wind.js version
 ***********************************************************************/

var Wind = require("../../../src/wind");

fs.existsAsync = Wind.Async.Binding.fromCallback(fs.exists);
fs.readFileAsync = Wind.Async.Binding.fromStandard(fs.readFile);

var transferFileAsync = eval(Wind.compile("async", function (request, response) {
    var uri = url.parse(request.url).pathname;
    var filepath = path.join(process.cwd(), uri);

    var exists = $await(fs.existsAsync(filepath));
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
