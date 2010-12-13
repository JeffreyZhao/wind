Jscex.Async.Node = {};
Jscex.Async.Node.Http = {};
Jscex.Async.Node.Path = {};
Jscex.Async.Node.FileSystem = {};

Jscex.Async.Node.Path.extend = function (path) {

    path.existsAsync = function (filepath) {
        return {
            start: function (callback) {
                path.exists(filepath, function (exists) {
                    callback("normal", exists);
                });
            }
        };
    };
}

Jscex.Async.Node.FileSystem.extend = function (fs) {
    fs.readFileAsync = function (filepath) {
        return {
            start: function (callback) {
                fs.readFile(filepath, function (error, data) {
                    var result = { error: error, data: data };
                    callback("normal", result);
                });
            }
        };
    }
}
