XMLHttpRequest.prototype.receiveAsync = function () {
    var _this = this;

    var delegate = {
        "onStart": function (callback) {
            _this.onreadystatechange = function () {
                if (_this.readyState == 4) {
                    callback("success", _this.responseText);
                }
            }

            _this.send();
        },

        "onCancel": function (callback) {
            _this.abort();
        }
    };

    return new Wind.Async.Task(delegate);
}
