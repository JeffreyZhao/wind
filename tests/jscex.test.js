"use strict";

require("should");

var Jscex = require("../src/jscex");

describe("underscore helpers", function () {

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
    });

});

