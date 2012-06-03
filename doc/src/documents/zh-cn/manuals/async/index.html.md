---
layout: manual-zh-cn
title: 异步模块
---

Jscex从诞生开始，便注定会在异步编程方面进行全方面的支持，因为其背后的理论，以及这种理论在C#，F#或是Scala中的实践，都是以异步编程为核心的。异步编程是各个平台都会遇到的问题，而Jscex便是将其他平台针对此类问题所做的探索，支持以及编程模式，引入到传统JavaScript开发过程中。

## <a name="import-module"></a>引入Jscex异步模块

如果您要使用Jscex异步模块，首先必须[引入基础模块](../base/)，之后再基于这个对象初始化异步模块。在开发环境里，可能您还需要[引入Jscex JIT编译器](../jit/)。

### <a name="import-module-nodejs"></a>Node.js

如果您使用的是Node.js，可以直接使用[Node Package Manager](http://npmjs.org/)（即npm命令）安装最新的jscex-async模块：

    npm install jscex-async

然后便可以在脚本中引入并初始化这个模块：

    var Jscex = require("jscex"); // 引入基础模块
    require("jscex-jit").init(Jscex) // 引入并初始化Jscex JIT编译器
    require("jscex-async").init(Jscex); // 引入并初始化Jscex异步模块

如果您想使用的是正在开发中的版本，请下载[jscex-builderbase.js](../src/jscex-builderbase.js)以及[jscex-async.js](../src/jscex-async.js)文件。前者为[Jscex通用构造器的基础模块](../builderbase/)，在发布至npm时已经一起和异步模块一起打包在内。将这两个文件放在相同目录下，并使用加载本地文件模块的方式加载jscex-async模块：

    var Jscex = require("./jscex"); // 引入基础模块
    require("./jscex-jit").init(Jscex) // 引入并初始化Jscex JIT编译器
    require("./jscex-async").init(Jscex); // 引入并初始化Jscex异步模块

此类方式也适合非[Node.js](http://nodejs.org/)，但实现[CommonJS规范](http://www.commonjs.org/)的JavaScript运行环境。

### <a name="import-module-browser"></a>浏览器

在浏览器环境中使用Jscex异步模块，您同样需要[引入基础模块](../base/)。此时在根（即window对象）上会出现一个Jscex对象。在开发环境里还需要[加载Jscex JIT编译器](../jit/)，然后再引入[jscex-builderbase.js](https://github.com/JeffreyZhao/jscex/blob/master/src/jscex-builderbase.js)以及[jscex-async.js](https://github.com/JeffreyZhao/jscex/blob/master/src/jscex-async.js)文件即可：

    <!-- 基础模块 -->
    <script src="jscex.js"></script>

    <!-- 解析器及JIT编译器模块 -->
    <script src="jscex-parser.js"></script>
    <script src="jscex-jit.js"></script>

    <!-- 构造器基础及异步模块 -->
    <script src="jscex-builderbase.js"></script>
    <script src="jscex-async.js"></script>

这两个文件会自动为根上的Jscex对象添加异步模块相关的成员，而这种方式也适合各类**没有**实现CommonJS规范的JavaScript运行环境。

## <a name="define-async-method"></a>定义异步方法

在JavaScript里定义一个普通方法很容易，例如：

    var print = function (text) {
        console.log(text);
    }

而创建一个Jscex里的“异步方法”，其实就是使用“异步构造器”（即`"async"`）来创建一个Jscex方法，即：

    var printAsync = eval(Jscex.compile("async", function (text) {
        console.log(text);
    }));

其中`eval(Jscex.compile("async", …))`部分只是一个包装，一种标识，让程序员可以清楚的意识到这不是一个普通方法。在使用Jscex的时候，我们不会在其他任何地方，其他任何一种方式使用`eval`或是`Jscex.compile`，完全不会表现出其“邪恶”的一面，更不会出现在生产环境中。更多信息，请参考“[Jscex调试](../debugging.html)”相关内容。

## <a name="use-async-method"></a>使用异步方法

### <a name="use-async-method-directly"></a>直接使用

与普通使用不同的是，异步方法在执行后并不会立即启动方法体内的代码，而是会返回一个`Jscex.Async.Task`类型的对象（后文也会称做“任务对象”或是Task对象）：

    // 输出“Hello World”
    print("Hello World");

    // 得到Jscex.Async.Task对象
    var task = printAsync("Hello World");

如果要启动这个task对象，只需调用其`start()`方法即可：

    task.start(); // 输出“Hello World”

关于`Jscex.Async.Task`类型成员及其功能，请参考后文“Jscex.Async.Task类型详解”部分。任何一个Jscex异步方法，都可以使用`start()`方法启动，无需依赖其他异步方法（见下节）。这点经常被人忽略，但对于那些需要在已有项目中逐步引入Jscex的情况来说却十分重要。

### <a name="use-async-method-in-another"></a>在其他异步方法内使用

对于一个Jscex异步方法返回的Task对象来说，最常见的使用方式便是在另一个异步方法内，通过`$await`命令来执行。例如：

    var printAllAsync = eval(Jscex.compile("async", function (texts) {
        for (var i = 0; i < texts.length; i++) {
            $await(printAsync(texts[i])); // 使用$await命令执行一个Task对象
        }
    }));

当然，对于这里的`printAsync`方法来说，由于其内部并没有其他异步操作（您可以简单的理解为“没有`$await`命令”），因此它所返回的Task对象，其执行效果和普通的`print`方法没有什么区别。但是在实际使用时，我们使用的是更有意义的异步操作，例如在[异步增强模块](./powerpack.html)中提供的`Jscex.Async.sleep`方法：

    var printEverySecond = eval(Jscex.compile("async", function (texts) {
        for (var i = 0; i < texts.length; i++) {
            $await(Jscex.Async.sleep(1000)); // “暂停”一秒
            console.log(text[i]);
        }
    }));

我们知道，JavaScript环境并没有提供“暂停”或是“阻塞”一段时间这样的方法，唯一能提供“延迟执行”功能的只有`setTimeout`。而`setTimeout`只能做到在一段时间后执行一个回调方法，因此便无法在一个使用JavaScript中的`for`或是`while`关键字来实现循环，也无法靠`try…catch`来捕获到回调函数出错时抛出的异常。

而在Jscex异步方法中，这一切都不是问题。`$await`将为您保证异步操作的执行顺序，您可以使用最传统的编程方式来表达算法，由Jscex来帮您搞定异步操作的各种问题。

### <a name="use-async-method-await"></a>$await指令的语义

Jscex函数是标准的JavaScript，支持JavaScript语言几乎所有特性：条件判断就用`if…else`或`switch`，错误捕获就用`try…catch…finally`，循环就用`while`、`for`、`do`，其他包括`break`，`continue`，`return`等等，都是最普通的JavaScript写法，而在Jscex异步方法中，唯一新增的便是`$await`指令。

`$await`指令的使用形式便是普通的方法调用，但事实上在上下文中并没有这个方法。它的作用与`eval(Jscex.compile("async", …))`一样，仅仅是个占位符，让Jscex知道在这个地方需要进行“特殊处理”。

`$await`指令的参数只有一个，便是一个`Jscex.Async.Task`类型的对象，这个对象可以是一个异步方法的返回结果，或是由其他任何方式得到。例如，之前所演示的`Jscex.Async.sleep(1000)`，其实便是返回一个表示“等待1秒钟”的Task对象。因此这句代码：

    $await(Jscex.Async.sleep(1000));

在需要时也可以写作：

    var task = Jscex.Async.sleep(1000);
    $await(task)

`$await`指令的确切语义是：“**等待该Task对象结束（返回结果或抛出错误）；如果它尚未启动，则启动该任务；如果已经完成，则立即返回结果（或抛出错误）**”。因此，我们也可以在需要的时候灵活使用`$await`指令。例如在一个Node.js应用程序中，时常会实现下面的逻辑：
    
    var getUserItemsAsync = eval(Jscex.compile("async", function (userId) {

        var user = $await(queryUserAsync(userId));
        var items = $await(queryItemsAsync(userId));

        return {
            user: user,
            items: items
        };
    });

在上面的代码中，`queryUserAsync`与`queryItemsAsync`是依次执行的，如果前者耗时200毫秒，后者耗时300毫秒，则总共需要500毫秒才能完成。但是，在某些情况下，我们可以让两个操作“并发”执行，例如：

    var getUserItemsAsync = eval(Jscex.compile("async", function (userId) {

        var queryUserTask = queryUserAsync(userId);
        // 手动启动queryUserAsync任务，start方法调用将立即返回。
        queryUserTask.start();

        var items = $await(queryItemsAsync(userId));
        var user = $await(queryUserTask); // 等待之前的任务完成

        return {
            user: user,
            items: items
        };
    });

在`$await(queryUserTask)`时，如果该任务已经完成，则会立即返回结果，否则便会等待其完成。因此，当这两个互不依赖的查询操作并发执行的情况下，总耗时将会减少到300毫秒。

## <a name="task-model"></a>任务模型

`$await`指令的参数是`Jscex.Async.Task`类型的对象，这个对象这个对象可以是一个异步方法的返回结果，或是由其他任何方式得到。在Jscex异步模块眼中，一个异步任务便是指“**能在未来某个时刻返回的操作**”，它可以是一个`setTimeout`的绑定（如之前演示过的`sleep`方法），甚至是一个用户事件：

    var btnNext = document.getElementById("btnNext");
    var ev = $await(Jscex.Async.onEvent(btnNext, "click"));
    console.write(ev.clientX, ev.clientY);

因为在Jscex异步模块眼中，用户的点击行为，也是“能在未来某个时刻返回的操作”，这便是一个异步任务。您可以在后文“[模态对话框](samples/modal-dialog.html)”以及“[汉诺塔](samples/hanoi.html)”示例中了解这个模型的威力。

除了上文提到的`sleep`及`onEvent`以外，[异步增强模块](./powerpack.html)里还包含了更多有用的辅助方法，来应对常见的异步协作问题。例如之前的“并发”执行示例，在实际情况下往往会使用异步增强模块中的`whenAll`辅助方法：

    var Task = Jscex.Task;

    var getUserItemsAsync = eval(Jscex.compile("async", function (userId) {

        return $await(Task.whenAll({
            user: queryUserAsync(userId),
            items: queryItemsAsync(userId)
        }));
    });

`whenAll`辅助方法会将输入的多个任务包装为一个整体，并同样以Task对象的形式返回。新的Task对象只有在所有输入任务都结束的情况下才会完成，并使用相同的结构（“键值”或“数组”）返回其结果。

Jscex的异步模型经过C#，F#及Scala等多种语言平台的检验，可以说拥有非常灵活而丰富的使用模式。

## <a name="cancellation-model"></a>取消模型

取消操作也是异步编程中十分常见但也十分麻烦的部分。因此，Jscex异步模块在任务模型中融入一个简单的取消功能，丰富其潜在功能及表现能力。

但是，Jscex对Task对象上并没有一个类似`cancel`这样的方法，这点可能会出乎某些人的意料。在实现“取消模型”这个问题上，我们首先必须清楚一点的是：**并非所有的异步操作均可撤销**。有的任务一旦发起，就只能等待其安全结束。因此，我们要做的，应该是“要求取消该任务”，至于任务会如何响应，便由其自身来决定了。在Jscex的异步模型中，这个“通知机制”便是由`Jscex.Async.CancellationToken`类型（下文也会称作CancellationToken）提供的。

CancellationToken的cancel方法便用于“取消”一个或一系列的异步操作。更准确地说，它是将自己标识为“要求取消”并“通知”相关相关的异步任务。这方面的细节将在后续章节中讲解，目前我们先来了解一下Jscex异步模块中的任务取消模型。如果您要取消一个任务，怎么需要先准备一个CancellationToken对象：

    var ct = new Jscex.Async.CancellationToken();

然后，对于支持取消的异步任务，都会接受一个CancellationToken作为参数，并根据其状态来行动。这里我们还是以异步增强模块中的`sleep`方法进行说明：

    var printEverySecondAsync = eval(Jscex.compile("async", function (ct) {
        var i = 0;
        while (true) {
            $await(Jscex.Async.sleep(1000, ct));
            console.log(i++);
        }
    }));

    printEverySecondAsync(ct).start();

如果您在浏览器或是Node.js的JavaScript交互式控制台上运行上述代码，将会从0开始，每隔一秒打印一个数字，永不停止，直到有人调用`ct.cancel()`为止。

在一个Jscex异步方法中，“取消”的表现形式为“异常”。例如，在`ct.cancel()`调用之后，上述代码的中的`$await(Jscex.Async.sleep(1000, ct))`语句将会抛出一个`Jscex.Async.CanceledError`错误，我们可以使用`try…catch`进行捕获：

    var ct = new CancellationToken();
    var task = Jscex.Async.sleep(5000, ct);
    try {
        setTimeout(function () { ct.cancel() }, 1000); // 1秒后调用ct.cancel();
        $await(task);
    } catch (ex) {
        console.log(CancelledError.isTypeOf(ex)); // true
        console.log(task.status); // canceled
    }

如果某个Task对象抛出了`CancelledError`错误对象，则它的`status`字段会返回字符串`"canceled"`，表明其已被取消。同理，对于一个Jscex异步方法来说，如果从内部抛出一个未被捕获的`CancelledError`错误对象，则它的状态也会标识为“已取消”。试想，在很多情况下，我们不会用`try…catch`来捕获一个`$await`指令所抛出的异常，于是这个异常会继续顺着“调用栈”继续向调用者传递，于是相关路径上所有的Task对象都会成为`canceled`状态。这是一个**简单而统一**的模型。

有些情况下我们也需要手动操作CancellationToken对象，向外抛出一个`CanceledError`错误，以表示当前异步方法已被取消：

    if (ct.isCancellationRequested) {
        throw new Jscex.Async.CanceledError();
    }

或直接：

    ct.throwIfCancellationRequested();

`throwIfCancellationRequested`是CancellationToken对象上的辅助方法，其实就是简单地检查`isCancellationRequested`字段是否为true，并抛出一个`CanceledError`对象。

有时候我们也需要手动判断`isCancellationRequested`，因为可能我们需要在取消的时候做一些“收尾工作”，于是便可以：

    if (ct.isCancellationRequested) {

        // 做些收尾工作

        throw new Jscex.Async.CanceledError();
    }

或是：

    try {
        $await(…); // 当任务被取消时
    } catch (ex) {
        if (CancelledError.isTypeOf(ex)) { // 取消引发的异常
            // 做些收尾工作
        }

        throw ex; // 重新抛出异常
    }

值得注意的是，由于JavaScript的单线程特性，一般只需在异步方法刚进入的时候，或是某个`$await`指令之后才会使用`isCancellationRequested`或是`throwIfCancellationRequested`。我们没有必要在其他时刻，例如两个`$await`指令之间反复访问这些成员，因为它们的行为不会发生任何改变。

## <a name="async-operation-binding"></a>将任意异步操作绑定为Task对象

世界上有无数种异步模型，从最简单的回调函数传递结果，用户行为引发的事件，到相对复杂的Promise模型。而在Jscex的异步模块种，能够被`$await`指令识别的，便是用`Jscex.Async.Task`类型来表达的异步任务。任何的异步方法，在执行后都能得到一个Task对象，但如果是其他平台或是环境所提供异步模型，便需要经过绑定才能被`$await`使用。

### <a name="async-operation-binding-simple"></a>绑定简单操作

将任何一个异步操作Task对象，会需要用到`Jscex.Async.Task`类型的`create`静态方法。方便起见，通常我们可以使用`Task`来指向这个全命名：

    var Task = Jscex.Async.Task;

例如在Node.js中[内置的Path模块中的`exists`方法](http://nodejs.org/docs/v0.6.5/api/path.html#path.exists)，便是一个十分简单的异步操作，它会将结果通过回调函数返回：

    path.exists('/etc/passwd', function (exists) {
        util.debug(exists ? "it's there" : "no passwd!");
    });

但如果我们要在Jscex异步方法里使用这个函数，则需要将其进行简单绑定：

    path.existsAsync = function (p) {
        return Task.create(function (t) {
            path.exists(p, function (exists) {
                t.complete("success", exists);
            });
        });
    }

于是`existsAsync`就会返回一个Task对象，它在`start`以后，便会调用原来的`exists`方法获得结果。我们也可以将其用在某个Jscex异步方法中：

    // 某Jscex异步方法内
    var exists = $await(path.existsAsync("/etc/passwd"));
    util.debug(exists ? "it's there" : "no passwd!");

绑定一个异步方法的基本方式可以分为以下几点：

1. 边写一个新方法，其中返回`Task.create`的执行结果（一个Task对象）。
2. `Task.create`方法的参数为一个回调函数（下文称为委托方法），它会在这个Task对象的`start`方法调用时执行，发起被绑定的异步操作。
3. 委托方法的参数是当前的Task对象（也是之前`Task.create`创建的对象），在异步操作完成后，使用其`complete`方法通知Task对象“已完成”。
4. `complete`方法的第一个参数为字符串`"success"`，表示该异步操作执行成功，并可以通过第二个参数传回该异步操作的结果（亦可空缺）。

### <a name="async-operation-binding-raise-error"></a>引发异常

并非所有的异步操作都会成功，在平时“非异步”的编程方式中，我们往往会在出错的情况下抛出异常。如果一个异步操作引发了异常，我们只需要在调用Task对象的`complete`方法时，将第一个参数从`"success"`替换为`"failure"`，并将第二个参数设为错误对象即可。例如Node.js中内置的[File System模块的`readFile`方法](http://nodejs.org/docs/v0.6.5/api/fs.html#fs.readFile)便可能会失败：

    fs.readFile('/etc/passwd', function (err, data) {
        if (err) {
            util.debug("Error occurred: " + err);
        } else {
            util.debug("File length: " + data.length);
        }
    });

而将其绑定为Task对象时只需：

    fs.readFileAsync = function (path) {
        return Task.create(function (t) {
            fs.readFile(path, function (err, data) {
                if (err) {
                    t.complete("failure", err);
                } else {
                    t.complete("success", data);
                }
            });
        });
    }

于是在一个Jscex异步方法中使用时：

    // 某Jscex异步方法内
    try {
        var data = $await(fs.readFileAsync(path));
        util.debug("File length: " + data.length);
    } catch (ex) {
        util.debug("Error occurred: " + ex);
    }

错误处理也是异步编程的主要麻烦之处之一。在异步环境中，我们往往需要在“每个”异步操作的回调函数里判断是否出现错误，一旦有所遗漏，在出现问题之后就很难排查了。例如：

    fs.readFile(file0, function (err0, data0) {
        if (err0) {
            // 错误处理
        } else {
            fs.readFile(file1, function (err1, data1) {
                if (err1) {
                    // 错误处理
                } else {
                    fs.readFile(file2, function (err2, data2) {
                        if (err2) {
                            // 错误处理
                        } else {
                            // 使用data0，data1和data 2
                        }
                    });
                }
            });
        }
    });

如今Jscex改变了这个窘境，只需要一个`try…catch`便可以捕获到任意多个异步操作的异常，保留了传统编程过程中的实践：

    try {
        var data0 = $await(fs.readFileAsync(file0));
        var data1 = $await(fs.readFileAsync(file1));
        var data2 = $await(fs.readFileAsync(file2));
        // 使用data0，data1和data2
    } catch (ex) {
        // 错误处理
    }

甚至，在编写绝大多数Jscex异步方法的时候，我们并不需要显式地进行`try…catch`，我们可以让异常直接向方法外抛出，由统一的地方进行处理。

### <a name="async-operation-binding-cancellation"></a>取消操作

从上文的“取消模型”中我们得知，所谓“取消”只不过是引发一个`isCancellation`为true的异常而已。因此，要表示当前异常操作被取消，也只需要向`complete`方法传入`"failure"`即可。不过问题的关键是，我们如果要绑定一个现有的异步操作，往往还需要在取消时实现一些“清理”工作。这里，我们便以异步增强模块中的`sleep`方法来演示“取消”操作的实现方式。

`sleep`方法绑定了JavaScript运行环境中的`setTimeout`及`clearTimeout`函数，它们的基本使用方式为：

* `var seed = setTimeout(fn, delay);`：表示在`delay`毫秒以后执行`fn`方法，并返回`seed`作为这次操作的标识，供`clearTimeout`使用。
* `clearTimeout(seed);`：在`fn`被执行之前，可以使用`clearTimeout`取消这次操作。这样即便到了时间，也不会执行fn方法了。

基于这两个功能，我们便可以实现`sleep方法`及其取消功能了。实现支持取消的异步操作绑定往往分三步进行：

    var Task = Jscex.Async.Task;
    var CanceledError = Jscex.Async.CanceledError;

    var sleep = function (delay, /* CancellationToken */ ct) {
		return Task.create(function (t) {
            // 第一步
			if (ct && ct.isCancellationRequested) {
                t.complete("failure", new CanceledError());
            }

            // 第二步
            var seed;
            var cancelHandler;
            
            if (ct) {
                cancelHandler = function () {
                    clearTimeout(seed);
                    t.complete("failure", new CanceledError());
                }
            }
            
            // 第三步
            var seed = setTimeout(function () {
                if (ct) {
                    ct.unregister(cancelHandler);
                }
                
                t.complete("success");
            }, delay);
            
            if (ct) {
                ct.register(cancelHandler);
            }
		});
    }

**第一步：判断CancellationToken状态。**取消操作由CancellationToken类型对象来提供，但由于其往往是可选操作，因此`ct`参数可能为`undefined`。在sleep方法一开始，我们先判断`ct.isCancellationRequested`是否为true，“是”便直接将Task对象传递“取消”信息。这是因为在某些特殊情况下，该CancellationToken已经被标识为取消了，作为支持取消操作的异步绑定，这可以算作是一个习惯或是规范。

**第二步：准备取消方法。**在这里我们准备两个变量`seed`和`cancelHandler`，前者将在稍后发起`setTimeout`时赋值。我们只在用户传入`ct`时才创建`cancelHandler`方法，该方法执行时会使用`clearTimeout(seed)`来取消已经发起的`setTimeout`操作，并通过`complete`方法将该Task对象传递“取消”信息。

**第三步：发起异步操作并注册取消方法。**接着便要发起我们绑定的异步函数了。我们将`setTimeout`后得到的标识符保留在seed变量里，供之前的`cancelHandler`使用。在`delay`毫秒后会执行的方法中，我们将注册在`ct`上的取消方法去除，并通过`complete`方法将该Task对象标识为`"success"`。发起异步操作之后，再讲取消方法注册到`ct`上。当有人调用`ct`的`cancel`方法时，该取消方法便会被执行。

将一个支持取消的异步操作绑定为Task对象是最为麻烦的工作，幸好这样的操作并不多见，并且也有十分规则的模式可以遵循。

### <a name="async-operation-binding-helpers"></a>辅助方法

似乎将已有的异步操作绑定为Task对象是十分耗时的工作，但事实上它的工作量并不一定由我们想象中那么大。这是因为在相同的环境，类库或是框架里，它们各种异步操作都具有相同的模式。例如在Node.js中，基本都是`path.exists`和`fs.readFile`这种模式下的异步操作。因此在实际开发过程中，我们不会为各个异步操作各实现一份绑定方法，而是使用[异步增强模块](./powerpack.html)里的辅助方法，例如：

    var Jscex = require("jscex-jit");
    require("jscex-async").init(Jscex);
    require("./jscex-async-powerpack").init(Jscex);

    var path = require("path"),
        fs = require("fs");
    Jscexify = Jscex.Async.Jscexify;

    path.existsAsync = Jscexify.fromCallback(path.exists);

    fs.readAsync = Jscexify.fromStandard(fs.read, "bytesRead", "buffer");
    fs.writeAsync = Jscexify.fromStandard(fs.write, "written", "buffer");

    fs.readFileAsync = Jscexify.fromStandard(fs.readFile);
    fs.writeFileAsync = Jscexify.fromStandard(fs.writeFile);

这便是JavaScript语言的威力。

## <a name="task-api"></a>Jscex.Async.Task 类型详解

`Jscex.Async.Task`是Jscex异步模块内的标准异步模型。异步方法产生的Task对象，除了可以交给`$await`指令使用之外，也可以直接使用这个对象。这种做法在某些场合十分重要，例如要在系统中逐步引入Jscex的情况。

### 静态 create(delegate)

该方法是Task类型上的静态方法，用于创建一个Task对象，多在将普通异步操作绑定为Task的时候使用。

参数`delegate`方法会在Task启动时（即`start`方法被调用时）执行，签名为`function (t)`，其中`t`即为此次`create`调用所返回的Task对象。

使用示例：

    Task.create(function (t) {
        console.log(t.status); // running
    });

### start()

该方法用于启动任务，只可调用一次。

使用示例：

    var task = someAsyncMethod();
    task.start();

### addEventListener(ev, listener)

该方法用于添加一个事件处理器，只能在Task对象状态为`ready`或`running`的时候添加。

参数`ev`为是以字符串表示的事件名，可以为：

* **success**：任务执行成功时触发，此时该任务的`status`字段为`succeeded`，且`result`字段为执行结果。
* **failure**：任务执行失败时触发，此时该任务的`status`字段为`faulted`或`canceled`（视错误对象的`isCancallation`字段而定），且`error`字段为错误对象。
* **complete**：无论任务成功还是失败，都会触发该事件。

参数`listener`为事件处理方法，无参数，执行时`this`为触发事件的Task对象。

使用示例：

    var task = someAsyncMethod();

    task.addEventListener("success", function () {
        console.log("Task " + this.id + " is succeeded with result: " + this.result);
    });

    task.addEventListener("failure", function (t) {
        console.log("Task " + this.id + " is failed with error: " + this.error);
    });

    task.addEventListener("complete", function (t) {
        console.log("Task " + this.id + " is completed with status: " + this.status);
    });

### removeEventListener(ev, listener)

该方法用于去除一个事件处理器，提供与`addEventListener`功能相反的操作。值得注意的是，在`complete`方法调用之后，Task对象会自动释放对事件处理器，不会继续保持对它们的引用。

### complete(type, value)

该方法用于通知该Task对象已“完成”（无论结果如何），多在将普通异步操作绑定为Task的时候使用。根据不同情况，参数的值应分别为：

* **成功**：参数`type`为`"success"`，`value`为任务的执行结果。 
* **出错**：参数`type`为`"failure"`，`value`为错误对象，其`isCancellation`字段为false。
* **取消**：参数`type`为`"failure"`，`value`为错误对象，其`isCancellation`字段为true。

使用示例：

    fs.readFileAsync = function (path) {
        return Task.create(function (t) {
            fs.readFile(path, function (err, data) {
                if (err) {
                    t.complete("failure", err); // 出错
                } else {
                    t.complete("success", data); // 成功
                }
            });
        });
    }

### id

该字段为Task对象的标识符，为全局唯一的自增整型。

### status

该字段标识Task对象的状态，可分为以下几种情况：

* **ready**：创建完成，等待启动。
* **running**：正在执行。
* **succeeded**：执行成功。
* **faulted**：执行出错。
* **canceled**：执行已取消。

### result

该字段保存了Task对象执行**成功**后得到的结果，在异步方法内将作为`$await`指令的返回值。

### error

该字段保存了Task对象执行失败（**出错**或**取消**）后的错误对象，在异步方法内将作为异常抛出。
    
## Jscex.Async.CancellationToken

实现任务取消功能时离不开`Jscex.Async.CancellationToken`对象，它有以下成员：

### register(handler)

该方法用于注册一个取消时的回调方法`handler`，它会在`cancel`方法调用时执行。如果`cancel`已经调用过，则`handler`会立即执行。

### unregister(handler)

该方法用于去除取消时的回调方法`handler`，它是`register`方法的相反操作。

### cancel()

该方法用于发出取消请求，调用后会将`isCancellationRequested`字段设为true，并执行所有已注册的取消回调方法。取消后，所有的回调方法会被释放，CancellationToken对象不会保留对取消回调方法的引用。

### isCancellationRequested

该字段表示是否已经提出取消请求。

### throwIfCancellationRequested()

该方法用于在取消请求已经提出的情况下抛出一个`isCancellation`为true的错误对象。它是一个方便开发者使用的辅助方法，简单等价为：

    if (this.isCancellationRequested) {
        throw new Jscex.Async.CancelledError();
    }
    
## <a name="samples"></a>示例

### <a name="samples-browser"></a>浏览器示例

* [时钟](samples/clock.html)：演示最基础的使用方式。
* [排序算法动画](samples/sorting-algorithms.html)：各类排序算法（冒泡，选择，快速）的演示动画。
* [模态对话框](samples/modal-dialog.html)：演示Jscex对于前端用户交互编写方式的改进。
* [汉诺塔](samples/hanoi.html)：汉诺塔解决方案的动画演示，同时涉及用户前端交互。

### <a name="samples-nodejs"></a>Node.js示例

* [复制完整目录](samples/copy-dir.html)：使用Node.js编写复制完整目录的功能
* [静态文件服务器](samples/static-server.html)：演示Node.js环境中最基础的使用方式。
* [使用Express开发网站](samples/express-server.html)：使用Jscex改善业务逻辑表现方式，并增强程序并发性。

### <a name="samples-others"></a>其他

* [jQuery异步操作绑定](samples/jquery-bindings.html)：提供部分jQuery及其相关插件中异步操作的绑定。

## <a name="related-links"></a>相关链接

* [源代码](https://github.com/JeffreyZhao/jscex/blob/master/src/jscex-async.js)
* [异步增强模块](./powerpack.html)
* [JIT编译器](../jit/)
* [AOT编译器](../aot/)
