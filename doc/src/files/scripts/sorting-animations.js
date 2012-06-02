var SortingAnimations = function (canvas) {
    
    var ctx = canvas.getContext ? canvas.getContext("2d") : null;

    var randomArray = function () {
        var array = [];
        var length = Math.floor(canvas.width / 3);
        
        for (var i = 1; i < canvas.width / 3; i++) {
            array.push(i);
        }

        array.sort(function() { return (Math.round(Math.random()) - 0.5); });
        return array;
    }
    
    var paint = function (array) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.beginPath();

        for (var i = 0; i < array.length; i++)
        {
            var x = 2 + i * 3;
            var height = array[i] * 3 * canvas.height / canvas.width;
            
            ctx.moveTo(x, canvas.height);
            ctx.lineTo(x, canvas.height - height);
        }
        
        ctx.stroke();
    }
    
    var compareAsync = /* async << function (x, y) { */   (function (x, y) {
                                       var _builder_$0 = Jscex.builders["async"];
                                       return _builder_$0.Start(this,
                                           _builder_$0.Delay(function () {
/*     $await(Jscex.Async.sleep(10)); */       return _builder_$0.Bind(Jscex.Async.sleep(10), function () {
/*     return x - y; */                            return _builder_$0.Return(x - y);
                                               });
                                           })
                                       );
/* } */                            })
;

    var swapAsync = /* async << function (array, x, y) { */   (function (array, x, y) {
                                              var _builder_$0 = Jscex.builders["async"];
                                              return _builder_$0.Start(this,
                                                  _builder_$0.Delay(function () {
/*     var t = array[x]; */                           var t = array[x];
/*     array[x] = array[y]; */                        array[x] = array[y];
/*     array[y] = t; */                               array[y] = t;
/*     paint(array); */                               paint(array);
/*     $await(Jscex.Async.sleep(20)); */              return _builder_$0.Bind(Jscex.Async.sleep(20), function () {
                                                          return _builder_$0.Normal();
                                                      });
                                                  })
                                              );
/* } */                                   })
;
    
    var partitionAsync = /* async << function (array, begin, end) { */      (function (array, begin, end) {
                                                       var _builder_$0 = Jscex.builders["async"];
                                                       return _builder_$0.Start(this,
                                                           _builder_$0.Delay(function () {
/*     var i = begin; */                                       var i = begin;
/*     var j = end; */                                         var j = end;
/*     var pivot = array[Math.floor((begin + end) / 2)]; */    var pivot = array[Math.floor((begin + end) / 2)];
                                                               return _builder_$0.Combine(
                                                                   _builder_$0.While(function () {
/*     while (i <= j) { */                                             return i <= j;
                                                                   },
                                                                       _builder_$0.Combine(
                                                                           _builder_$0.While(function () {
/*         while (true) { */                                                   return true;
                                                                           },
                                                                               _builder_$0.Delay(function () {
/*             var r = $await(compareAsync(array[i], pivot)); */                   return _builder_$0.Bind(compareAsync(array[i], pivot), function (r) {
/*             if (r < 0) { */                                                         if (r < 0) {
/*                 i ++; */                                                                i ++;
/*             } else { */                                                             } else {
/*                 break; */                                                               return _builder_$0.Break();
/*             } */                                                                    }
                                                                                       return _builder_$0.Normal();
                                                                                   });
                                                                               })
/*         } */                                                            ),
                                                                           _builder_$0.Combine(
                                                                               _builder_$0.While(function () {
/*         while (true) { */                                                       return true;
                                                                               },
                                                                                   _builder_$0.Delay(function () {
/*             var r = $await(compareAsync(array[j], pivot)); */                       return _builder_$0.Bind(compareAsync(array[j], pivot), function (r) {
/*             if (r > 0) { */                                                             if (r > 0) {
/*                 j --; */                                                                    j --;
/*             } else { */                                                                 } else {
/*                 break; */                                                                   return _builder_$0.Break();
/*             } */                                                                        }
                                                                                           return _builder_$0.Normal();
                                                                                       });
                                                                                   })
/*         } */                                                                ),
                                                                               _builder_$0.Delay(function () {
/*         if (i <= j) { */                                                        if (i <= j) {
/*             $await(swapAsync(array, i, j)); */                                      return _builder_$0.Bind(swapAsync(array, i, j), function () {
/*             i ++; */                                                                    i ++;
/*             j --; */                                                                    j --;
                                                                                           return _builder_$0.Normal();
                                                                                       });
/*         } */                                                                    } else {
                                                                                       return _builder_$0.Normal();
                                                                                   }
                                                                               })
                                                                           )
                                                                       )
/*     } */                                                        ),
                                                                   _builder_$0.Delay(function () {
/*     return i; */                                                    return _builder_$0.Return(i);
                                                                   })
                                                               );
                                                           })
                                                       );
/* } */                                            })
;
    
    var quickSortAsync = /* async << function (array, begin, end) { */           (function (array, begin, end) {
                                                            var _builder_$0 = Jscex.builders["async"];
                                                            return _builder_$0.Start(this,
                                                                _builder_$0.Delay(function () {
/*     var index = $await(partitionAsync(array, begin, end)); */    return _builder_$0.Bind(partitionAsync(array, begin, end), function (index) {
                                                                        return _builder_$0.Combine(
                                                                            _builder_$0.Delay(function () {
/*     if (begin < index - 1) { */                                              if (begin < index - 1) {
/*         $await(quickSortAsync(array, begin, index - 1)); */                      return _builder_$0.Bind(quickSortAsync(array, begin, index - 1), function () {
                                                                                        return _builder_$0.Normal();
                                                                                    });
/*     } */                                                                     } else {
                                                                                    return _builder_$0.Normal();
                                                                                }
                                                                            }),
                                                                            _builder_$0.Delay(function () {
/*     if (index < end) { */                                                    if (index < end) {
/*         $await(quickSortAsync(array, index, end)); */                            return _builder_$0.Bind(quickSortAsync(array, index, end), function () {
                                                                                        return _builder_$0.Normal();
                                                                                    });
/*     } */                                                                     } else {
                                                                                    return _builder_$0.Normal();
                                                                                }
                                                                            })
                                                                        );
                                                                    });
                                                                })
                                                            );
/* } */                                                 })
;
    
    this.supported = !!ctx;
    this.randomArray = randomArray;
    this.paint = paint;
    
    this.quickSortAsync = /* async << function (array) { */                    (function (array) {
                                                         var _builder_$0 = Jscex.builders["async"];
                                                         return _builder_$0.Start(this,
                                                             _builder_$0.Delay(function () {
/*     $await(quickSortAsync(array, 0, array.length - 1)); */    return _builder_$0.Bind(quickSortAsync(array, 0, array.length - 1), function () {
                                                                     return _builder_$0.Normal();
                                                                 });
                                                             })
                                                         );
/* } */                                              })
;
};
