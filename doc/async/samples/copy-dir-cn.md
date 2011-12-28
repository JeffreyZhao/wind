# 复制完整目录 - Jscex异步示例

## 描述

[Node.js](http://nodejs.org/)是目前最流行的JavaScript开发技术，通过异步IO这一卖点吸引了许多技术人员的目光。Node.js的绝大部分API都是异步的，通过回调函数或是事件（也可以视为一种回调函数）进行交互，这虽然提高了应用程序的性能及伸缩性，却也显著提高了程序复杂度。

Jscex对Node.js提供了直接的支持。本文将通过实现一个目录复制的功能，演示如何使用[Jscex异步模块](../README-cn.md)辅助Node.js开发。我们会发现，无论是条件判断也好，递归调用也罢，使用Jscex开发异步程序与普通的程序编写模式几乎没有区别。

## 需求

除了网络相关的支持以外，Node.js也提供了一些文件操作的API，我们可以用其进行创建、删除、修改等常见的文件操作。不过Node.js目前并没有提供文件的复制的API，更不论复制整个目录了。这便是我们这次要完成的功能。

总体而言，我们是要编写一个`copy-dir.js`模块，在执行之后：

    node copy-dir.js ./hello ./world

会将“./hello”目录下的内容完整地复制到“./world”目录去，包括子目录里面的内容。在复制过程中需要打印出一定信息，例如：

    File "./world/skip.txt" exists, overwrite? > no
    Copying "./hello/abc.txt" to "./world/abc.txt" ... done.
    File "./world/error.txt" exists, overwrite? > yes
    Copying "./hello/error.txt" to "./world/error.txt" ... ERROR!!!
    Copying "./hello/large-files/1.zip" to "./world/large-files/1.zip" ...

规则如下：

1. 假如目标文件已存在，则提示用户是否覆盖：
   * 用户输入“yes”或“y”（不区分大小写）：覆盖目标文件。
   * 用户输入“no”或“n”（不区分大小写）：跳过该文件。
2. 开始复制文件是，打印“Copying”信息。
   * 复制结束，打印“done”字样。
   * 复制失败，打印“ERROR!!!”字样。

## 相关API

要完成以上操作，可能涉及到以下一些API。由于我们这个模块可能会到服务器或是远程环境下，因此每一步操作都需要是异步的，降低任何阻塞的可能性：

### 复制文件

在Node.js中复制一个文件有两种方式，一种是使用File System模块的[open](http://nodejs.org/docs/latest/api/fs.html#fs.open)方法打开文件，[read](http://nodejs.org/docs/latest/api/fs.html#fs.read)和[write](http://nodejs.org/docs/latest/api/fs.html#fs.write)方法读写文件，并使用[close](http://nodejs.org/docs/latest/api/fs.html#fs.close)方法关闭文件，如下：

    var fs = require("fs");

    // 打开一个文件，得到文件标识符fd
    fs.open(path, flags, function (err, fd) {
        
    });
    
    // 读文件
    fs.read(fd, buffer, offset, length, position, function (err, bytesRead, buffer) {
        
    });
    
    // 写文件
    fs.write(fd, buffer, offset, length, position, function (err, written, buffer) {
    
    });
    
    // 关闭文件
    fs.close(fd, function () {

    })

或是使用数据流传输的方式，打开两个Stream并使用[pipe](http://nodejs.org/docs/latest/api/streams.html#stream.pipe)方法传输数据。数据传输完成之后，会触发目标数据流的`close`事件，在出错时则会在两个Stream对象上引发error事件：

    var fs = require("fs");
    
    var streamIn = fs.createReadStream("./input.txt");
    var streamOut = fs.createWriteStream("./output.txt");
    
    streamIn.pipe(streamOut);
    
    streamIn.on("error", function (error) {
        // 输入流异常
    });
    
    streamOut.on("error", function (error) {
        // 输出流异常
    });
    
    streamOut.on("close", function () {
        // 数据传输完毕
    });

通常来说，第二种方法的性能相对更高一些。此外，在Node.js的util模块中也提供了`pump`辅助方法来实现两个数据流的传输：

    var util = require("util");
    util.pump(streamIn, streamOut, function (err) {
        if (err) {
            // error occurred
        }
    });

使用这种方法，在处理错误的时候会更方便一些。

### 其他操作

向屏幕打印文字：

    var util = require("util");
    util.print("Hello World");

读取用户操作：

    var rl = require("readline").createInterface(process.stdin, process.stdout);
    rl.question("Please answer the question: ", function (answer) {
        // 用户回车后获得答案
    });

检查目录或文件是否存在：

    var path = require("path");
    path.exists("/etc/passwd", function (exists) {
        // exists参数表示是否存在
    });

创建目录：

    var fs = require("fs");
    fs.mkdir("./world", function (err) {
        if (err) {
            // 出错
        }
    });

列出指定里的内容：

    var fs = require("fs");
    fs.readdir(path, function (err, files) {
        // files为目录里的文件及子目录（不包含子目录里的内容）
    });

判断该路径是文件还是目录：

    var fs = require("fs");
    fs.stat(path, function (err, stats) {
        if (stats.isFile()) {
            // 文件
        } else if (stats.isDirectory()) {
            // 目录
        }
    });

## 实现

### 引入组件

首先我们引入实现功能所需要的Node.js组件：

    var fs = require("fs");    var path = require("path");    var util = require("util");    var rl = require("readline").createInterface(process.stdin, process.stdout);

并为相关的方法创建Jscex绑定：

    var Jscex = require("../../src/jscex");
    require("../../src/jscex-jit").init(Jscex);    require("../../src/jscex-async").init(Jscex);    require("../../src/jscex-async-powerpack").init(Jscex);    var Async = Jscex.Async;    var Task = Async.Task;    var Jscexify = Async.Jscexify;    // path bindings    path.existsAsync = Jscexify.fromCallback(path.exists);    // util bindings    util.pumpAsync = Jscexify.fromStandard(util.pump);    // rl bindings    rl.questionAsync = Jscexify.fromCallback(rl.question);    // fs bindings    fs.mkdirAsync = Jscexify.fromStandard(fs.mkdir);    fs.readdirAsync = Jscexify.fromStandard(fs.readdir);    fs.statAsync = Jscexify.fromStandard(fs.stat);    fs.closeAsync = Jscexify.fromStandard(fs.close);    fs.openAsync = Jscexify.fromStandard(fs.open);    fs.readAsync = Jscexify.fromStandard(fs.read);    fs.writeAsync = Jscexify.fromStandard(fs.write);由此可见，虽然涉及的方法众多，但都被[异步增强模块](../powerpack-cn.md)提供的绑定辅助方法`fromCallback`及`fromStandard`一网打尽。

### 目录复制

目录复制是个异步方法（因为其中必然涉及到大量的异步IO操作），它的工作是将源目录`srcDir`里的所有内容复制到目标目录`targetDir`中去签名如下：

    var copyDirAsync = eval(Jscex.compile("async", function (srcDir, targetDir) {        ...    }));

首先，它将判断目标目录是否已经存在，如果不存在则创建一个，其中会用到`path.exists`和`fs.mkdir`两个异步方法：

    var copyDirAsync = eval(Jscex.compile("async", function (srcDir, targetDir) {        var exists = $await(path.existsAsync(targetDir));        if (!exists) {            $await(fs.mkdirAsync(targetDir));        }        ...    }));然后，使用`fs.readdir`异步方法获取源目录内所有的文件及目录，并使用循环遍历每一项。对每一项使用`fs.stat`异步方法判断其种类，如果是文件，则使用`copyFileAsync`复制文件，否则便递归调用自身以复制子目录：

    var copyDirAsync = eval(Jscex.compile("async", function (srcDir, targetDir) {        ...        var files = $await(fs.readdirAsync(srcDir));        for (var i = 0; i < files.length; i++) {            var srcPath = path.join(srcDir, files[i]);            var targetPath = path.join(targetDir, files[i]);                        var stat = $await(fs.statAsync(srcPath));            if (stat.isFile()) {                $await(copyFileAsync(srcPath, targetPath));            } else {                $await(copyDirAsync(srcPath, targetPath));            }        }    }));### 文件复制

文件复制也是个异步方法，它的工作是将源文件`srcFile`复制为目标文件`targetFile`，签名如下：

    var copyFileAsync = eval(Jscex.compile("async", function (srcFile, targetFile) {        ...    }));

首先使用`path.exists`异步方法判断目标文件是否存在，如果存在则提示用户做出覆盖与否的选择，直到用户给出正确的输入之后才会继续进行下去：

    var copyFileAsync = eval(Jscex.compile("async", function (srcFile, targetFile) {        var exists = $await(path.existsAsync(targetFile));        if (exists) {            var message = util.format('File "%s" exists, overwirte? (yes/no) > ', targetFile);            while (true) {                var answer = $await(rl.questionAsync(message));                if (/^(?:yes|y)$/i.test(answer)) {                    break;                } else if (/^(?:no|n)$/i.test(answer)) {                    return;                }            }        }        ...    }));

假如确定要复制目标文件，则进行复制操作。我们使用`try…catch`捕获复制操作可能出现的异常，一旦发生错误，则以为着文件复制失败，打印“ERROR”字样：

    var copyFileAsync = eval(Jscex.compile("async", function (srcFile, targetFile) {        ...        util.print(util.format('Copying "%s" to "%s" ... ', srcFile, targetFile));                try {            $await(copyFileByLoopAsync(srcFile, targetFile));            // $await(copyFileByPumpAsync(srcFile, targetFile));            // $await(copyFileByPipeAsync(srcFile, targetFile));
            util.print("done\n");        } catch (ex) {            util.print("ERROR!!!\n");        }    }));

这里我们会实现之前所提到的所有三种复制方式，您可以选择任意一种来进行文件复制操作。

### 使用file.read，file.write方法复制文件

第一种复制文件的方式基于`file.read`和`file.write`方法，循环读写，直至复制完毕：

    var copyFileByLoopAsync = eval(Jscex.compile("async", function (srcFile, targetFile) {        var fdIn = $await(fs.openAsync(srcFile, "r"));        var fdOut = $await(fs.openAsync(targetFile, "w"));        var bufferSize = 10240;        var buffer = new Buffer(bufferSize);        try {            while (true) {                var lengthRead = $await(fs.readAsync(fdIn, buffer, 0, bufferSize, null));                if (lengthRead <= 0) break;                $await(fs.writeAsync(fdOut, buffer, 0, lengthRead, null));            }        } finally {            $await(fs.closeAsync(fdIn));            $await(fs.closeAsync(fdOut));        }    }));

当读写操作出错的时候，自然会有异常向方法外抛出，而`finally`则保证即便在出错的情况下，两个文件描述符`fdIn`和`fdOut`均能正常关闭，不会发生泄露。

### 使用stream.pipe复制文件

第二种复制文件的方式，则是开启两个数据流，并使用`pipe`方法传递数据：

    var copyFileByPipeAsync = eval(Jscex.compile("async", function (srcFile, targetFile) {        var streamIn = fs.createReadStream(srcFile);        var streamOut = fs.createWriteStream(targetFile);        streamIn.pipe(streamOut);                var any = $await(Task.whenAny({            errorIn: Async.onEvent(streamIn, "error"),            errorOut: Async.onEvent(streamOut, "error"),            end: Async.onEvent(streamOut, "close")        }))        if (any.key != "end") {            throw any.task.result;        }    }));

在发起`pipe`之后会有三种可能，一种是引发`streamOut`的`close`事件，表示传输完毕。另一种可能是引发`streamIn`或`streamOut`的`error`事件，则意味着传输过程中出现了错误。多者取一，因此我们使用异步增强库中的`whenAny`方法进行辅助。假如完成的不是代表了成功的任务，则将其结果（即错误对象）作为异常抛出。

### 使用util.pump传输数据

与`pipe`相比，`util.pump`是个更为易用的接口：

    var copyFileByPumpAsync = eval(Jscex.compile("async", function (srcFile, targetFile) {        var streamIn = fs.createReadStream(srcFile);        var streamOut = fs.createWriteStream(targetFile);        $await(util.pumpAsync(streamIn, streamOut));    }));由于`util.pump`方法使用了标准的传递错误的方式，因此使用`fromStandard`创建的绑定，已经能够正确的抛出异常。
## 相关链接

* [完整代码](../../../samples/async/copy-dir.js)
* [Jscex异步模块](../README-cn.md)
* [Jscex异步增强模块](../powerpack-cn.md)