# Jscex异步模块

Jscex从诞生开始，便注定会在异步编程方面进行全方面的支持，因为其背后的理论，以及这种理论在C#，F#或是Scala中的实践，都是以异步编程为核心的。异步编程是各个平台都会遇到的问题，而Jscex便是将其他平台针对此类问题所做的探索，支持以及编程模式，引入到传统JavaScript开发过程中。

## 引入Jscex异步模块

如果您要使用Jscex异步模块，首先必须[引入Jscex JIT编译器](../jit-cn.md)，之后您会得到了一个Jscex根对象，之后再基于这个对象初始化异步模块。

### Node.js

如果您使用的是Node.js，可以直接使用[Node Package Manager](http://npmjs.org/)（即npm命令）安装最新的jscex-async模块：

    npm install jscex-async

然后便可以在脚本中引入并初始化这个模块：

    var Jscex = require("jscex-jit"); // 引入Jscex JIT编译器
    require("jscex-async").init(Jscex); // 引入并初始化Jscex异步模块

如果您想使用的是正在开发中的版本，请下载[jscex-builderbase.js](../src/jscex-builderbase.js)以及[jscex-async.js](../src/jscex-async.js)文件。前者为[Jscex通用构造器的基础模块](../builderbase-cn.md)，在发布至npm时已经一起和异步模块一起打包在内。将这两个文件放在相同目录下，并使用加载本地文件模块的方式加载jscex-async模块：

    var Jscex = require("./jscex-jit") // 引入本地Jscex JIT编译器
    require("./jscex-async").init(Jscex); // 引入并初始化本地文件模块

此类方式也适合非[Node.js](http://nodejs.org/)，但实现[CommonJS规范](http://www.commonjs.org/)的JavaScript运行环境。

### 浏览器

在浏览器环境中使用Jscex异步模块，您同样需要[加载Jscex JIT编译器](../jit-cn.md)。此时在根（即window对象）上会出现一个Jscex对象，然后在页面上引入[jscex-builderbase.js](../src/jscex-builderbase.js)以及[jscex-async.js](../src/jscex-async.js)文件即可：

    <script src="jscex-builderbase.js"></script>
    <script src="jscex-async.js"></script>

这两个文件会自动为根上的Jscex添加异步模块相关的成员，而这种方式也适合各类**没有**实现CommonJS规范的JavaScript运行环境。

## 定义异步方法

在JavaScript里定义一个普通方法很容易，例如：

    var print = function (text) {
        console.log(text);
    }

而创建一个Jscex里的“异步方法”，其实就是使用“异步构造器”（即`"async"`）来创建一个Jscex方法，即：

    var printAsync = eval(Jscex.compile("async", function (text) {
        console.log(text);
    )});

其中`eval(Jscex.compile("async", …))`部分只是一个包装，一种标识，让程序员可以清楚的意识到这不是一个普通方法。在使用Jscex的时候，我们不会在其他任何地方，其他任何一种方式使用`eval`或是`Jscex.compile`，完全不会表现出其“邪恶”的一面，更不会出现在生产环境中。更多信息，请参考“[Jscex调试](../debugging-cn.md)”相关内容。

## 使用异步方法

### 直接使用

与普通使用不同的是，异步方法在执行后并不会立即启动方法体内的代码，而是会返回一个`Jscex.Async.Task`类型的对象（后文也会称做“任务对象”或是Task对象）：

    // 输出“Hello World”
    print("Hello World");

    // 得到Jscex.Async.Task对象
    var task = printAsync("Hello World");

如果要启动这个task对象，只需调用其`start()`方法即可：

    task.start(); // 输出“Hello World”

关于`Jscex.Async.Task`类型成员及其功能，请参考[相关文档](#)。任何一个Jscex异步方法，都可以使用`start()`方法启动，无需依赖其他异步方法（见下节）。这点经常被人忽略，但对于那些需要在已有项目中逐步引入Jscex的情况来说却十分重要。

### 在其他异步方法内使用

对于一个Jscex异步方法返回的Task对象来说，最常见的使用方式便是在另一个异步方法内，通过`$await`命令来执行。例如：

    var printAllAsync = eval(Jscex.compile("async", function (texts) {
        for (var i = 0; i < texts.length; i++) {
            $await(printAsync(text[i])); // 使用$await命令执行一个Task对象
        }
    }));

当然，对于这里的`printAsync`方法来说，由于其内部并没有其他异步操作（您可以简单的理解为“没有`$await`命令”），因此它所返回的Task对象，其执行效果和普通的`print`方法没有什么区别。但是在实际使用时，我们使用的是更有意义的异步操作，例如在[异步增强模块](async-powerpack-cn.md)中引入的`Jscex.Async.sleep`方法：

    var printEverySecond = eval(Jscex.compile("async", function (texts) {
        for (var i = 0; i < texts.length; i++) {
            $await(Jscex.Async.sleep(1000)); // “暂停”一秒
            console.log(text[i]);
        }
    }));

我们知道，JavaScript环境并没有提供“暂停”或是“阻塞”一段时间这样的方法，唯一能提供“延迟执行”功能的只有`setTimeout`。而`setTimeout`只能做到在一段时间后执行一个回调方法，因此便无法在一个使用JavaScript中的`for`或是`while`关键字来实现循环，也无法靠`try…catch`来捕获到回调函数出错时抛出的异常。

而在Jscex异步方法中，这一切都不是问题。`$await`将为您保证异步操作的执行顺序，您可以使用最传统的编程方式来表达算法，由Jscex来帮您搞定异步操作的各种问题。

## $await指令的语义

Jscex函数是标准的JavaScript，支持JavaScript语言几乎所有特性：条件判断就用`if…else`或`switch`，错误捕获就用`try…catch…finally`，循环就用`while`、`for`、`do`，其他包括`break`，`continue`，`return`等等，都是最普通的JavaScript写法，而在Jscex异步方法中，唯一新增的便是`$await`指令。

`$await`指令的使用形式便是普通的方法调用，但事实上在上下文中并没有这个方法。它的作用与`eval(Jscex.compile("async", …))`一样，仅仅是个占位符，让Jscex知道在这个地方需要进行“特殊处理”。

`$await`指令的参数只有一个，便是一个`Jscex.Async.Task`类型的对象，这个对象可以是一个异步方法的返回结果，或是由其他任何方式得到。例如，之前所演示的`Jscex.Async.sleep(1000)`，其实便是返回一个表示“等待1秒钟”的Task对象。因此这句代码：

    $await(Jscex.Async.sleep(1000));

再需要时也可以写作：

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

## 任务模型

`$await`指令的参数是`Jscex.Async.Task`类型的对象，这个对象这个对象可以是一个异步方法的返回结果，或是由其他任何方式得到。在Jscex异步模块眼中，一个异步任务便是指“**能在未来某个时刻返回的操作**”，它可以是一个`setTimeout`的封装（如之前演示过的`sleep`方法），甚至是一个用户事件：

    var btnNext = document.getElementById("btnNext");
    var ev = $await(Jscex.Async.onEvent(btnNext, "click"));
    console.write(ev.clientX, ev.clientY);

因为在Jscex异步模块眼中，用户的点击行为，也是“能在未来某个时刻返回的操作”，这便是一个异步任务。您可以在后文“[模态对话框](samples/modal-dialog-cn.md)”以及“[汉诺塔](samples/hanoi-cn.md)”示例中了解这个模型的威力。

除了上文提到的`sleep`及`onEvent`以外，[异步增强模块](async-powerpack-cn.md)里还包含了更多有用的辅助方法，来应对常见的异步协作问题。例如之前的“并发”执行示例，在实际情况下往往会使用异步增强模块中的`whenAll`辅助方法：

    var Task = Jscex.Task;

    var getUserItemsAsync = eval(Jscex.compile("async", function (userId) {

        var results = $await(Task.whenAll(
            queryUserAsync(userId),
            queryItemsAsync(userId)
        ));

        return {
            user: results[0],
            items: results[1]
        };
    });

`whenAll`辅助方法会将输入的多个任务封装为一个整体，并同样以Task对象的形式返回。新的Task对象只有在所有输入任务都结束的情况下才会完成，并使用数组返回其结果。

Jscex的异步模型经过C#，F#及Scala等多种语言平台的检验，可以说拥有非常灵活而丰富的使用模式。

## 取消模型

取消操作也是异步编程中十分常见但也十分麻烦的部分。因此，Jscex异步模块在任务模型中融入一个简单的取消功能，丰富其潜在功能及表现能力。

但是，Jscex对Task对象上并没有一个类似`cancel`这样的方法，这点可能会出乎某些人的意料。在实现“取消模型”这个问题上，我们首先必须清楚一点的是：**并非所有的异步操作均可撤销**。有的任务一旦发起，就只能等待其安全结束。因此，我们要做的，应该是“要求取消该任务”，至于任务会如何响应，便由其自身来决定了。在Jscex的异步模型中，这个“通知机制”便是由`Jscex.Async.CancellationToken`类型提供的。

## 将任意异步操作封装为Task对象
TODO

## 示例

* [时钟](clock-cn.md)：演示最基础的使用方式。
* [排序算法动画](sorting-animation-cn.md)：各类排序算法（冒泡，选择，快速）的演示动画。
* [模态对话框](modal-dialog-cn.md)：演示Jscex对于前端用户交互编写方式的改进。
* [汉诺塔](hanoi-cn.md)：汉诺塔解决方案的动画演示，同时涉及用户前端交互。
* [静态文件服务器](static-server-cn.md)：演示Node.js环境中最基础的使用方式。
* [使用Express开发网站](express-server-cn.md)：使用Jscex改善业务逻辑表现方式，并增强程序并发性。
