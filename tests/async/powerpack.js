"use strict";

var Jscex = require("../../src/jscex");
require("../../src/jscex-async").init(Jscex);
require("../../src/jscex-async-powerpack").init(Jscex);
require("should");

Jscex.logger.level = Jscex.Logging.Level.OFF;

var Task = Jscex.Async.Task;

Task.success = function (result) {
    return Task.create(function (t) {
        t.complete("success", result);
    });
};

Task.failure = function (error) {
    return Task.create(function (t) {
        t.complete("failure", error);
    });
}

Task.delay = function (timeout, error, result) {
    return Task.create(function (t) {
        return setTimeout(function () {
            if (error) {
                t.complete("failure", error);
            } else {
                t.complete("success", result);
            }
        }, timeout);
    });
}

// Add a member;
Object.prototype.abc = 123;

describe("Task", function () {

    describe("#whenAll()", function () {

        it("should directly return an empty object with an empty object input", function () {
            Task.whenAll({ }).start().result.should.eql({ });
        });

        it("should directly return an empty array with an empty array input", function () {
            Task.whenAll([]).start().result.should.eql([]);
        });

        it("should directly return the result if the task is already succeeded", function () {
            var t = Task.success(100).start();
            t.result.should.equal(100);

            Task.whenAll(t).start().result[0].should.equal(100);
        });

        it("should directly return the error if the task is already faulted", function () {
            var error = { };
            var t = Task.failure(error).start();
            t.error.should.equal(error);

            Task.whenAll(t).start().error.should.equal(error);
        });

        it("should return an array of results with a serial of tasks", function (done) {
            this.timeout(100);

            var t1 = Task.delay(0, null, 1);
            var t2 = Task.delay(0, null, 2);

            Task.whenAll(t1, t2).start().addEventListener("success", function () {
                this.result.should.eql([1, 2]);
                done();
            });
        });

        it("should return an array of result with an array input", function (done) {
            this.timeout(100);

            var t1 = Task.delay(0, null, 1);
            var t2 = Task.delay(0, null, 2);

            Task.whenAll([t1, t2]).start().addEventListener("success", function () {
                this.result.should.eql([1, 2]);
                done();
            });
        });

        it("should return a hash of results with a hash input", function (done) {
            this.timeout(100);

            var t1 = Task.delay(0, null, 1);
            var t2 = Task.delay(0, null, 2);

            Task.whenAll({ r1: t1, r2: t2 }).start().addEventListener("success", function () {
                this.result.should.eql({ r1: 1, r2: 2 });
                done();
            });
        });

        it("should return the error when one of the task in array is failed", function (done) {
            this.timeout(100);

            var error = { };
            var t1 = Task.delay(0, error, null);
            var t2 = Task.delay(0, null, 1);

            Task.whenAll(t1, t2).start().addEventListener("failure", function () {
                this.error.should.equal(error);
                done();
            });
        });

        it("should return the error when one of the task in hash is failed", function (done) {
            this.timeout(100);

            var error = { };
            var t1 = Task.delay(0, error, null);
            var t2 = Task.delay(0, null, 1);

            Task.whenAll({ r1: t1, r2: t2 }).start().addEventListener("failure", function () {
                this.error.should.equal(error);
                done();
            });
        });

        it("should return the object graph the same as the input tasks", function (done) {
            this.timeout(100);

            var input = {
                dataList: [
                    Task.delay(0, null, 1),
                    {
                        hello: Task.delay(0, null, "hello"),
                        world: Task.delay(0, null, "world"),
                        empty: 10
                    },
                    Task.delay(0, null, 2)
                ],
                value: Task.delay(0, null, 3),
                empty: { }
            };

            Task.whenAll(input).start().addEventListener("success", function () {
                this.result.should.eql({
                    dataList: [
                        1,
                        {
                            hello: "hello",
                            world: "world",
                            empty: { }
                        },
                        2
                    ],
                    value: 3,
                    empty: { }
                });
                done();
            });
        });
    });
});
