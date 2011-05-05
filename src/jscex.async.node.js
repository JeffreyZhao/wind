Jscex.Async.Node = {};
Jscex.Async.Node.Path = {};
Jscex.Async.Node.FileSystem = {};

Jscex.Async.Node.Path.extend = function (path) {

    path.existsAsync = function (filepath) {
        var delegate = {
            "start": function (callback) {
                path.exists(filepath, function (exists) {
                    callback("success", exists);
                });
            }
        };

        return new Jscex.Async.Task(delegate);
    };
}

Jscex.Async.Node.FileSystem.extend = function (fs) {

    fs.readFileAsync = function (filepath) {
        var delegate = {
            "start": function (callback) {
                fs.readFile(filepath, function (error, data) {
                    if (error) {
                        callback("failure", error);
                    } else {
                        callback("success", data);
                    }
                });
            }
        };

        return new Jscex.Async.Task(delegate);
    }
}
