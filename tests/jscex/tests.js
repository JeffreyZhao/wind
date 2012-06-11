"use strict";

var exports = (typeof window === "undefined") ? module.exports : window;

exports.setupTests = function (Jscex) {

    describe("underscore", function () {

        var _ = Jscex._;

        describe("isArray", function () {
        
            it("should return true for array", function () {
                _.isArray([]).should.equal(true);
            });
            
            it("should return false for others", function () {
                _.isArray("").should.equal(false);
                _.isArray(1).should.equal(false);
                _.isArray({}).should.equal(false);
            });
            
        });
        
        describe("each", function () {
        
            it("should iterate all array items", function () {
                var obj = {};
                
                _.each([1, 2, 3], function (i, v) { obj["i" + i] = v; });
                
                obj.should.eql({ i0: 1, i1: 2, i2: 3 });
            });
            
            it("should break the array iteration when get a value", function () {
                var obj = {};
                
                var value = _.each([1, 2, 3, 4, 5], function (i, v) {
                    obj["i" + i] = v;
                    if (v == 3) return "Hello World";
                });
                
                value.should.equal("Hello World");
                obj.should.eql({ i0: 1, i1: 2, i2: 3 });
            });
            
            it("should iterate all map items", function () {
                var obj = {};
                
                _.each({ a: 1, b: 2, c: 3 }, function (k, v) { obj["k" + k] = v; });
                
                obj.should.eql({ ka: 1, kb: 2, kc: 3 });
            });
            
            it("should break the map iteration when get a value", function () {
                var obj = {};
                
                var value = _.each({ a: 1, b: 2, c: 3, d: 4, e: 5 }, function (k, v) {
                    obj["k" + k] = v;
                    if (v == 3) return "Hello World";
                });
                
                value.should.equal("Hello World");
                obj.should.eql({ ka: 1, kb: 2, kc: 3 });
            });
            
            it("should treat return as continue in loop", function () {
                var obj = {};
                
                _.each({ a: 1, b: 2, c: 3, d: 4 }, function (k, v) {
                    if (v == 3) return;
                    obj["k" + k] = v;
                });
                
                obj.should.eql({ ka: 1, kb: 2, kd: 4 })
            });
        });

        describe("v2n", function () {
            it("should get number for simple version string", function () {
                _.v2n("1.2.3").should.equal(10203);
                _.v2n("10.2").should.equal(100200);
            });
        });
        
        describe("testVersion", function () {
            it("should return true if equals to the min version", function () {
                _.testVersion("~1.5.0", "1.5.0").should.equal(true);
            });
            
            it("should return true if has higher minor revision", function () {
                _.testVersion("~1.5.0", "1.5.99").should.equal(true);
            });
            
            it("should return false if has less minor revision", function () {
                _.testVersion("~1.5.0", "1.4.0").should.equal(false);
            });
            
            it("should return false if equals to the next major revision", function () {
                _.testVersion("~1.5.0", "1.6.0").should.equal(false);
            });
        });
        
        describe("format", function () {
            it("should get formatted string in normal case", function () {
                _.format("{0}, {1}, {0}, {2}", 1, 2, 3).should.equal("1, 2, 1, 3");
                _.format("{0}, {1}, {0}, {2}", [1, 2, 3]).should.equal("1, 2, 1, 3");
                _.format("{0}, {1}, {{0}, {2}", 1, 2, 3).should.equal("1, 2, {1, 3");
                _.format("{0}, {1}, {0}}, {2}", 1, 2, 3).should.equal("1, 2, 1}, 3");
            });
            
            it("should keep unformatted string if braces are escaped", function () {
                _.format("{0}, {1}, {{0}}, {2}", 1, 2, 3).should.equal("1, 2, {0}, 3");
            });
        });
    });
}