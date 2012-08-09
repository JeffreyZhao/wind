"use strict";

var windc = require("../src/windc");

require("should");

describe("simple test", function () {

    it("should work", function () {

        var f = function () {
            eval(Wind.compile("async", function () {
                $await(Wind.Async.sleep(1000));
            }));
        }
    
        var newCode = windc.compile("var f = " + f.toString());
        newCode.match(/\$await/g).length.should.equal(1);
    });

});
