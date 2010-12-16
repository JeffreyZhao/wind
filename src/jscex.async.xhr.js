XMLHttpRequest.prototype.sendAsync = function() {
    var _this = this;
    return {
        start: function(callback) {
            _this.onreadystatechange = function() {
                if (_this.readyState == 4) {
                    callback("normal"); 
                }
            }

            _this.send();
        }
    };
}

XMLHttpRequest.prototype.receiveAsync = function() {
    var _this = this;
    return {
        start: function(callback) {
            _this.onreadystatechange = function() {
                if (_this.readyState == 4) {
                    callback("return", _this.responseText);
                }
            }

            _this.send();
        }
    };
}
