# Jscex异步增强模块

[Jscex异步模块](README-cn.md)中提供了Jscex支持异步编程的核心类库，例如Task类型或是异步构造器。有了异步模块，我们就可以编写异步方法，或是将某种异步操作封装为Task对象等等。但是，异步模块除了提供了核心功能以外，并没有对日常异步开发中的常见任务给与足够的支持。而Jscex异步模块便对常见的异步开发模式，或是异步操作的绑定模式提供了支持。

## 异步方法

异步增强模块中提供了一些常见的异步方法，可直接使用。这些异步方法都定义在`Jscex.Async`模块之上。

### sleep(delay, [ct])

`sleep`方法用于将当前的异步方法暂停一段时间。该方法接受两个参数：

1. `delay`：表示暂停时长，单位为毫秒。
2. `ct`：可选参数，用于取消暂停操作的CancellationToken对象。

该异步方法没有返回值。

示例：

    var ct = new Jscex.Async.CancellationToken();

    var printEverySecond = eval(Jscex.compile("async", function (texts, ct) {        for (var i = 0; i < texts.length; i++) {            $await(Jscex.Async.sleep(1000, ct));            console.log(texts[i]);        }    }));

### onEvent(obj, eventName, [ct])

`onEvent`方法用于监听某个对象上某个事件的“下一次”触发。该方法接受三个参数：

1. `obj`：目标对象。
2. `eventName`：事件名。
3. `ct`：可选参数，用于取消监听操作的CancellationToken对象。

为了保证兼容性，`onEvent`会使用目标对象上的`addEventListener`、`addListener`或是`attachEvent`方法来监听事件，并在操作结束或是取消之后使用`removeEventListener`、`removeListener`或是`detachEvent`方法来取消监听。`onEvent`将会返回事件对象，即事件触发时传递给监听器的第一个参数。

示例：

    var Async = Jscex.Async;    var ct = new Async.CancellationToken();    var drawLinesAsync = eval(Jscex.compile("async", function (board, ct) {        var currPoint = $await(Async.onEvent(board, "click", ct));        while (true) {            var nextPoint = $await(Async.onEvent(board, "click", ct));                        drawLine(                { x: currPoint.clientX, y: currPoint.clientY },                { x: nextPoint.clientX, y: nextPoint.clientY });                            currPoint = nextPoint;        }    }));

## 任务协作 

## 异步操作绑定

## 相关链接

* [源代码](../../src/src/jscex-async-powerpack.js)
* [异步模块](README-cn.md)
* [Node.js异步增强模块](node-cn.md)
* [浏览器异步增强模块](browser-cn.md)