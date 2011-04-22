XMLHttpRequest.prototype.receiveAsync = function () {
    var _this = this;

    var delegate = {
        "start": function (callback) {
            _this.onreadystatechange = function () {
                if (_this.readyState == 4) {
                    callback("success", _this.responseText);
                }
            }

            _this.send();
        }
    };

    return new Jscex.Async.Task(delegate);
}
