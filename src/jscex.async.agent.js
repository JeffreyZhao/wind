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

        return Jscex.Async.Task.create(function (t) {
            if (_this._queue.length > 0) {
                var message = _this._queue.shift();
                t.complete("success", message);
            } else {
                _this._task = t;
            }
        });
    },

    enqueue: function (message) {
        if (this._task) {
            var task = this._task;
            delete this._task;
            task.complete("success", message);
        } else {
            this._queue.push(message);
        }
    }
}
