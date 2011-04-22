require("../../bin/jscex.async.min.js");

var async = Jscex.builders["async"];

var makeTask = function (type, value) {
    return {
        start: function (_this, callback) {
            callback(type, value);
        }
    };
}

var makeTaskGenerator = function (_this, type, value) {
    return function () {
        if (this != _this) {
            throw new Error('"this" not matched!');
        }

        return makeTask(type, value);
    }
}

var makeValidator = function (expectedType, expectedValue) {
    return function (type, value) {
        console.log("Expected: " + expectedType + " - " + expectedValue);
        console.log("Actual: " + type + " - " + value);
        console.log("=============");
    };
}

///////////

var _this = {};

var normal = makeTask("normal"); 

var throwTry = makeTask("throw", "try");
var returnTry = makeTask("return", "try");

var normalCatch = makeTaskGenerator(_this, "normal");
var throwCatch = makeTaskGenerator(_this, "throw", "catch"); 
var returnCatch = makeTaskGenerator(_this, "return", "catch"); 

var throwFinally = makeTask("throw", "finally");
var returnFinally = makeTask("return", "finally");

/*****
try {
    // do nothing;
} catch (ex) {
    throw "catch";
}
*****/
async.Try(normal, throwCatch).start(_this, makeValidator("normal"));

/*****
try {
    throw "try";
} catch (ex) {
    // do nothing;
}
*****/
async.Try(throwTry, normalCatch).start(_this, makeValidator("normal"));

/*****
try {
    throw "try";
} catch (ex) {
    return "catch";
}
*****/
async.Try(throwTry, returnCatch).start(_this, makeValidator("return", "catch"));

/*****
try {
    throw "try";
} catch (ex) {
    throw "catch";
}
*****/
async.Try(throwTry, throwCatch).start(_this, makeValidator("throw", "catch"));

/*****
try {
    throw "try";
} finally {
    // do nothing;
}
*****/
async.Try(throwTry, null, normal).start(_this, makeValidator("throw", "try"));

/*****
try {
    throw "try";
} finally {
    return "finally";
}
*****/
async.Try(throwTry, null, returnFinally).start(_this, makeValidator("return", "finally"));

/*****
try {
    throw "try";
} finally {
    throw "finally";
}
*****/
async.Try(throwTry, null, throwFinally).start(_this, makeValidator("throw", "finally"));

/*****
try {
    throw "try";
} catch (ex) {
    throw "catch";
} finally {
    throw "finally";
}
*****/
async.Try(throwTry, returnCatch, throwFinally).start(_this, makeValidator("throw", "finally"));

/*****
try {
    throw "try";
} catch (ex) {
    throw "catch";
} finally {
    return "finally";
}
*****/
async.Try(throwTry, throwCatch, returnFinally).start(_this, makeValidator("return", "finally"));

/*****
try {
    return "try";
} catch (ex) {
    throw "catch";
} finally {
    throw "finally";
}
*****/
async.Try(returnTry, throwCatch, throwFinally).start(_this, makeValidator("throw", "finally"));

