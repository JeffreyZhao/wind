---
layout: manual-zh-cn
title: 包引入
---

Jscex使用高度模块化设计，模块之间互有依赖，并且在开发和生产环境中对模块的需求可能也各不相同。同时，Jscex也直接支持一些常见的包加载环境，例如[CommonJS](http://wiki.commonjs.org/wiki/Modules/1.1.1)及[AMD](http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition)环境，开发人员在使用时无需自行封装。

## <a name="dependency"></a>依赖

Jscex模块之间会有依赖，这些依赖信息会在模块定义时注册给[核心组件]。因此，在引入其他模块之前，必须首先加载[核心组件](./core/)。然后，再根据依赖种类的不同以及各自的需要，选择性地加载不同的模块。

### <a name="dependency-dynamic"></a>动态依赖

Jscex中的“动态依赖”，表示那些**不会**在模块初始化过程中自动加载的依赖。假设模块A和模块B有动态依赖，则意味着在初始化模块A之前需要手动初始化模块B。动态依赖的目的，主要是为了显式地强调被依赖模块的独立性，例如[异步增强模块](./async/powerpack.html)动态依赖于[异步模块](./async/)，便强调了异步模块在实际开发过程中一般是可以被单独使用的。

### <a name="dependency-static"></a>静态依赖

Jscex中的“静态依赖”，表示那些会在模块初始化过程中**自动加载**的依赖。假设模块A对模块B有静态依赖，则意味着初始化模块A时，Jscex会自动加载并初始化模块B。例如，[异步模块](./async/)静态依赖于[构造器基础模块](./builderbase/)，则意味着在使用异步模块时，我们只需要手动初始化异步模块即可，而构造器基础模块会被加载进来。

值得注意的是，这种“自动加载”需要一个包加载环境。在没有实现如CommonJS等包加载机制的JavaScript执行环境而言，我们仍需手动地加载Jscex各个模块文件。

## <a name="browser"></a>浏览器

在浏览器环境里使用Jscex其实最为清晰明了，因为我们无论如何必须手动加载所有的Jscex模块文件，完全不用区分“静态依赖”或是“动态依赖”。例如：

    <!-- 核心类库 -->
    <script src="jscex-x.y.z.js"></script>
    
    <!-- 构造器基础模块 -->
    <script src="jscex-builderbase-x.y.z.js"></script>
    <!-- 异步模块 -->
    <script src="jscex-async-x.y.z.js"></script>

可见，即便异步模块静态依赖于构造器基础模块，但我们仍需手动引入构造器基础模块的JavaScript文件。当引入所有文件之后，浏览器的根对象（即window对象）上将会出现一个`Jscex`变量，它便是所有Jscex功能的根对象。这种方法也适合没有实现任何包加载机制的普通JavaScript执行环境。

## <a name="nodejs"></a>Node.js

由于Node.js实现了CommonJS包加载机制，因此我们只需使用[Node Package Manager](http://npmjs.org/)（即npm命令）安装必要的包即可，例如：

    $ npm install jscex jscex-jit
    ...
    jscex@x.y.z ./node_modules/jscex 
    jscex-jit@x.y.z ./node_modules/jscex-jit 
    └── jscex-parser@x.y.z

由于jscex-jit模块对jscex-parser有着静态依赖，因此我们无需手动安装jscex-parser模块，再使用时也是如此：

    var Jscex = require("jscex"); // 核心组件
    require("jscex-jit").init(); // 加载并初始化jscex-jit模块

在使用任何模块之前，我们都必须先初始化[核心组件](./core/)，并将其赋值给`Jscex`变量。由于jscex-jit对jscex-parser有静态依赖，我们只需加载并初始化jscex-jit即可，无需手动加载jscex-parser模块。

而对于动态依赖的情况，我们则都必须手动进行模块的安装、加载及初始化工作，例如：

    $ npm install jscex jscex-async jscex-async-powerpack
    ...
    jscex@x.y.z ./node_modules/jscex 
    jscex-async@x.y.z ./node_modules/jscex-async 
    └── jscex-builderbase@x.y.z
    jscex-async-powerpack@x.y.z ./node_modules/jscex-async-powerpack 

在使用时：

    var Jscex = require("jscex"); // 核心组件
    require("jscex-async").init(); // 异步模块
    require("jscex-async-powerpack").init(); // 异步增强模块
    
假如我们一不小心遗漏了某些模块，则核心组件将会提示所需模块的名称和版本号，我们只需简单地查漏补缺即可。