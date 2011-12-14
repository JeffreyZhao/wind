# jQuery绑定

[jQuery](http://jquery.com)类库提供了丰富的异步操作，为了方便jQuery用户使用[Jscex异步模块]，并演示常见的异步操作绑定模式。在绑定已有的异步操作时，我们通常会保持原有的参数输入方式不变，而只关注操作的“完成点”，这样使用者便可以快速地了解新方法的使用方式。

## jQuery异步操作

jQuery提供了AJAX等典型的异步操作。

### $.ajax

AJAX方法是典型的异步操作，在jQuery中，发起一个AJAX请求使用的是`$.ajax`方法，例如：

    $.ajax({        url: "./getSomething",        dataType: "text",        success: function (data, textStatus, jqXHR) {            ...        },        error: function (jqXHR, textStatus, errorThrow) {            ...        }    });

以上代码会向地址`./getSomething`发起一个AJAX请求（`url: "./getSomething"`），用于获取文本内容（`dataType: "text"`），如果成功则执行`success`回调函数，其中`data`参数便是获得的文本内容，在出错时则执行`error`回调函数。因此，`success`和`error`便是该方法的两个完成点，绑定方式如下：

    $.ajaxAsync = function (options) {        return Task.create(function (t) {            options.success = function (data, textStatus, jqXHR) {                t.complete("success", {                    data: data,                    textStatus: textStatus,                    jqXHR: jqXHR                });            }            options.error = function (jqXHR, textStatus, errorThrow) {                t.complete("failure", {                    jqXHR: jqXHR,                    textStatus: textStatus,                    errorThrow: errorThrow                });            };            $.ajax(options);        });    };

## jQuery UI异步操作

[jQuery UI](http://jqueryui.com/)提供了许多常见的UI组件，它们也可以视为异步操作。“异步操作”是指那些“在未来某一时刻结束的操作”，因此，如对话框的“关闭”即可视为该“显示对话框”异步操作的结束标志。

### $.fn.dialog

jQuery UI提供了现成的[模态对话框组件](http://jqueryui.com/demos/dialog/)，例如其最简单的使用方式：

    <div id="dialog-demo" title="Dialog title">        <p>Dialog messages.</p>    </div>        <script>        $("#dialog-demo").dialog({
            modal: true,
            close: function () { … }
        });    </script>

`$("#some-id").dialog(…)`方法用于将某一个页面上的元素显示为对话框。我们设置`modal`参数为true，则它会成为一个模态窗口。`close`是一个回调函数，它会在窗体关闭的时候执行。如果我们要为对话框添加按钮，则可以这么实现：
    $("#dialog-demo").dialog({
        modal: true,
        close: function () { … },
        buttons: {
            "OK": function () {
                $(this).dialog("close");
            },
            "Cancel": function () {
                $(this).dialog("close");
            }
        }
    });

对于`dialog`方法来说，其“完成点”显然是其`close`回调函数，因此它的绑定为：

    $.fn.dialogAsync = function (options) {        var _this = this;        return Task.create(function (t) {            options.close = function () {                t.complete("success");            }            _this.dialog(options);        });    }

## 相关链接

* [完整代码](../../../samples/async/jquery-bindings.html)
* [Jscex异步模块](../README-cn.md)