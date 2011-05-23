function moveAsync(e, startPos, endPos, duration) {
    for (var t = 0; t < duration; t += 50) {
        e.style.left = (startPos.x + (endPos.x - startPos.x) * t / duration) + "px";
        e.style.top = (startPos.y + (endPos.y - startPos.y) * t / duration) + "px";
        $await(Jscex.Async.sleep(50));
    }
}
