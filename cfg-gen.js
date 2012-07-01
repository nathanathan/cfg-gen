var gensym = (function() {
    var uniqueSymbol = 1;
    function gensym(){
        uniqueSymbol++;
        return '-'+uniqueSymbol+'-';
    }
    return gensym;
}());

//This generates uids for the objects created:
//see: http://stackoverflow.com/questions/1997661/unique-object-identifier-in-javascript
(function() {
    var id_counter = 1;
    Object.defineProperty(Object.prototype, "__uid", {
        writable: true
    });
    Object.defineProperty(Object.prototype, "uid", {
        get: function() {
            if (this.__uniqueId == undefined)
                this.__uniqueId = id_counter++;
            return this.__uniqueId;
        }
    });
}());

function createDescriptor(obby){
    $.each(obby, function(key, value){
        obby[key] = {value : value, enumerable : true};
    });
    return obby;
}
function inheritFrom(a,b){
    //Using ECMAScript5's Object.create instead of classical jso pattern
    //see: http://ejohn.org/blog/ecmascript-5-objects-and-properties/
    return Object.create(a, createDescriptor(b));
}
function buildCFGraph(cfg, symbolObject){
    if(baseNode.isPrototypeOf(symbolObject)){
        return symbolObject;//we've already processed this one.
    }
    if(typeof symbolObject === "string"){
        symbolObject = { symbol : symbolObject };
    }
    if($.isArray(symbolObject)){
        var optionGroup = {items:[]};
        $.each(symbolObject, function(idx, item){
            optionGroup.items[idx] = buildCFGraph(cfg, item);
        });
        return inheritFrom(groupNode, optionGroup);
    }
    if(!symbolObject.symbol){
        //anonymous object
        symbolObject.symbol = 'gensym';
    }
    if(!symbolObject.options){
        if(symbolObject.symbol in cfg){
            symbolObject.options = cfg[symbolObject.symbol];
        } else {
            symbolObject.value = symbolObject.symbol;
            return inheritFrom(baseNode, symbolObject);
        }
    }
    var options = symbolObject.options;
    $.each(options, function(i){
        options[i] = buildCFGraph(cfg, options[i]);
    });
    return inheritFrom(baseNT, symbolObject);
}

var baseNode = {
    symbol : null,//change to name
    value : null,
    renderHTML : function(){
        if(this.value instanceof Object && 'renderHTML' in this.value){
            //hooray it quacks
            return this.value.renderHTML();
        } else {
            return $('<span>').html(this.value);
        }
    }
};
var groupNode = inheritFrom( baseNode, {
    items : [],
    renderHTML : function(){
        var $container = $('<div>').addClass('group');
        $.each(this.items, function(idx, item){
            $container.append(item.renderHTML());
        });
        return $container;
    }
});
//NT = non-terminal
var baseNT = inheritFrom( baseNode, {
    options : null,
    setValue : function(val){
        var NT = this;
        var NTPrototype = Object.create(NT);
        NTPrototype.value = val;
        $('.uid'+NT.uid).each(function(){
            $(this).replaceWith(NTPrototype.renderHTML());
        });
    },
    renderMenuHTML : function(){
        var NT = this;
        //Open menu
        var $list = $('<ul>').addClass('nav').addClass('nav-list');
        $.each(NT.options, function(i){
            var NToption = NT.options[i];
            //Put it in selectable row
            var $row = $('<li>');
            var $rowBtn = $('<input type="radio">').addClass('option-button');
            $rowBtn.click(function(){
                NT.setValue(NToption);
            });
            $row.append($rowBtn);
            $row.append(NToption.renderHTML());
            $list.append($row);
        });
        //$list.append($('<li class="divider"></li>'));
        var $menu = $('<div>').addClass('well').addClass('menu');
        $menu.append($('<div class="label label-info symbol">').text(NT.symbol));
        $menu.append($list);
        return $menu;
    },
    renderHTML : function(){
        var NT = this;
        var $symbol = $('<div class="label symbol">');
        $symbol.text(NT.symbol);
        var $container = $('<div>').addClass('options');
        $container.addClass('uid'+NT.uid);
        if(NT.value){
            //This is kind of like super
            $container.append(baseNode.renderHTML.call(this).addClass('selection'));
        } else {
            $container.append($symbol.clone());
        }
        var $btn = $('<button>').addClass('btn').text('options');
        var $menu = null;
        $btn.click(function(){
            if($menu){
                $menu.remove();
                $menu = null;
            } else {
                $menu = NT.renderMenuHTML();
                $container.append($menu);
            }
        });
        $container.append($btn);
        $container.addClass('selection');
        return $container;
    }
});
