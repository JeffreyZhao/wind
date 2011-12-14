# 模态对话框 - Jscex异步示例

## 示例描述

如今前端应用的交互特性越来越多，而模态对话框是其中最常见的使用案例。由于JavaScript和HTML的限制，各种用户交互的参与都必须以回调函数（或是事件，而事件其实也可以认为是回调函数的一种）。但实际上，这种做法在很多情况下不能说是最直接且最易用的表达方式。

本文将通过一个模态对话框与AJAX操作交互相结合的示例，演示如何使用Jscex异步模块来轻松直接地表达结合紧密的一系列异步逻辑。

## 需求定义

“删除”是前端应用中常见的操作。由于包含一定危险性，在进行删除之前，我们经常会向用户进行确认，然后再向服务器端发送一个AJAX请求删除数据。这个示例的需求便由此而来，如下：

1. 点击“清空”按钮，弹出确认对话框。
2. 用户选择“确定”或“取消”
   * 选择“确定”
     1. 发送AJAX请求至服务器端，完成后，
     2. 给用户以提示信息。
   * 选择“取消”，则给用户以提示信息。

为了保证用户体验，无论是“确定/取消”对话框，还是提示给用户看的信息，都不允许使用浏览器内置的`alert`和`confim`方法。也正是这点，增加了实现这一功能的复杂度。

## jQuery的AJAX操作及对话框

[jQuery](http://jquery.com/)提供了丰富的AJAX方法及界面组件。为了方便开发，我们将直接使用jQuery提供的AJAX功能以及jQuery UI提供的模态对话框。

### AJAX操作

[jQuery的AJAX操作](http://api.jquery.com/jQuery.ajax/)提供了丰富的功能选项，在此我们只关注其最简单的使用形式：

    $.ajax({        url: "./getSomething",        dataType: "text",        success: function (data, textStatus, jqXHR) {            ...        },        error: function (jqXHR, textStatus, errorThrow) {            ...        }    });

以上代码会向地址`./getSomething`发起一个AJAX请求（`url: "./getSomething"`），用于获取文本内容（`dataType: "text"`），如果成功则执行`success`回调函数，其中`data`参数便是获得的文本内容，在出错时则执行`error`回调函数。

### 对话框组件

同样，[jQuery UI](http://jqueryui.com/)也提供了现成的[模态对话框组件](http://jqueryui.com/demos/dialog/)，我们同样只关心其最简单的使用方式：

    <div id="dialog-demo" title="Dialog title">        <p>Dialog messages.</p>    </div>        <script>        $("#dialog-demo").dialog({
            modal: true,
            close: function () { … }
        });    </script>

`$(`#some-id`).dialog(…)`方法用于将某一个页面上的元素显示为对话框。我们设置`modal`参数为true，则它会成为一个模态窗口。`close`是一个回调函数，它会在窗体关闭的时候执行。

如果我们要为对话框添加按钮，则可以这么实现：

    <script>        $("#dialog-demo").dialog({
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
        });    </script>

在上面的代码中我们为对话框添加了两个按钮，分别是OK和Cancel，以及他们点击时调用的方法。我们可以在方法里加入任意的逻辑，而这里的代码则会关闭当前对话框。