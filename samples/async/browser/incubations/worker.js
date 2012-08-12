var i = 0;
onmessage = function (event) {
    setTimeout(function(){
        postMessage(i++);
    },1000);
};