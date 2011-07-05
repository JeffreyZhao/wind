Jscex.Async.Agent = function (mailboxProcessor) {
    this._mailbox = new Jscex.Async.Agent._Mailbox();
    mailboxProcessor(this._mailbox).start();
}
Jscex.Async.Agent.prototype.send = function (message) {
    this._mailbox.enqueue(message);
}

Jscex.Async.Agent._Mailbox = function () {
    this._queue = [];
}
Jscex.Async.Agent._Mailbox.prototype = {
    receive: function () {
        var _this = this;

        var delegate = {
            onStart: function (callback) {
                if (_this._queue.length > 0) {
                    var message = _this._queue.shift();
                    callback("success", message);
                } else {
                    _this._callback = callback;
                }
            },

            onCancel: function () {
                delete _this._callback;
            }
        };

        return new Jscex.Async.Task(delegate);
    },

    enqueue: function (message) {
        if (this._callback) {
            var callback = this._callback;
            delete this._callback;
            callback("success", message);
        } else {
            this._queue.push(message);
        }
    }
}
