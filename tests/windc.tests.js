"use strict";

var jscexc = require("../src/jscexc");

require("should");

describe("simple test", function () {

    it("should work", function () {

        var f = function () {
            eval(Jscex.compile("async", function () {
                $await(Jscex.Async.sleep(1000));
            }));
        }
    
        var newCode = jscexc.compile("var f = " + f.toString());
        newCode.match(/\$await/g).length.should.equal(1);
    });

});
