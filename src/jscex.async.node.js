Jscex.Async.Node = (function () {

    var Task = Jscex.Async.Task;

    var collectArgs = function (args, requiredArgs) {
        var result = [];
        for (var i = 0; i < args.length; i++) {
            result.push(args[i]);
        }

        while (result.length < requiredArgs) {
            result.push(null);
        }

        return result;
    }

    // for the methods return error or result
    var fromStandard = function (fn, requiredArgs) {
        return function () {
            var _this = this;
            var args = collectArgs(arguments, requiredArgs || 0);

            var delegate = {
                onStart: function (callback) {

                    args.push(function (error, result) {
                        if (error) {
                            callback("failure", error);
                        } else {
                            callback("success", result);
                        }
                    });

                    fn.apply(_this, args);
                }
            };
            
            return new Task(delegate);
        };
    };

    // for the methods always success
    var fromCallback = function (fn, requiredArgs) {
        return function () {
            var _this = this;
            var args = collectArgs(arguments, requiredArgs || 0);

            var delegate = {
                onStart: function (callback) {

                    args.push(function (result) {
                        callback("success", result);
                    });

                    fn.apply(_this, args);
                }
            };
            
            return new Task(delegate);
        }
    }

    return {
        fromStandard: fromStandard,
        fromCallback: fromCallback
    };

})();

for (var m in Jscex.Async.Node) {
    exports[m] = Jscex.Async.Node[m];
}

/*
Jscex.Async.Node.Path.extend = function (path) {

    path.existsAsync = function (filepath) {
        var delegate = {
            "onStart": function (callback) {
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
            "onStart": function (callback) {
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
*/
