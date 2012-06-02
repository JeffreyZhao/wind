"use strict";

document.createElement("header");
document.createElement("nav");
document.createElement("aside");
document.createElement("footer");
document.createElement("section");

$(document).ready(function () {

    var currentList = $("#toc-list").empty();
    var currentLevel = 2;
    
    var getName = function (h) {
        debugger;
        var link = h.firstChild;
        if (!link) return;
        if (!link.tagName) return;
        if (link.tagName.toLowerCase() != "a") return;
        if (link.innerHTML != "") return;

        return link.name;
    }
    
    var getLevel = function (h) {
        return h.tagName.toLowerCase() == "h2" ? 2 : 3;
    }
    
    var getLink = function (h, name) {
        return $("<a>").attr("href", "#" + name).text($(h).text());
    }
    
    var addToList = function () {
        var name = getName(this);
        if (!name) return;
        
        var level = getLevel(this);
        if (level > currentLevel) {
            var children = currentList.children();
            var lastItem = children[children.length - 1];
            
            var newList = $("<ul>").appendTo(lastItem);
            currentList = newList;
        } else if (level < currentLevel) {
            currentList = currentList.parent().parent();
        }
        
        currentLevel = level;
        
        $("<li>").append(getLink(this, name)).appendTo(currentList);
    }
    
    $("#container > h2, #container > h3").each(addToList);
});