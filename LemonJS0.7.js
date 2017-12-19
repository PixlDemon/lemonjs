////////////////////////////////////////////////////////////////
//LemonJS 0.7                                                 //
////////////////////////////////////////////////////////////////
/*
MIT License

Copyright (c) 2017 Moritz Amando Clerc(@PixlDemon)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

features:
 -scenes
 -entity system(create and manage entities, define components)
 -sprites
 -animations
 -input handling
 -some game math
 -tweening
 -create tilesets
 -load tiled worlds in tiled editor format
 -an universal asset loader
 -more, smaller stuff

feedback is highly appreciated :3
*/

let Lemon={
    classes:{},
    math:{},
    components:{},
    animations:[],
    tweens:[],
    entityCount:0,
    sceneCount:0,
    scale:1,
    lastStep:0,
    fixedUpdateInterval:1000/40,
    lastfixedUpdate:0,
    pixelart:true,
    mouse:{
        get worldX(){
            return (this.screenX/Lemon.scale)+Lemon.camX;
        },
        get worldY(){
            return (this.screenY/Lemon.scale)+Lemon.camY;
        },
        get world(){
            return {x:this.worldX,y:this.worldY}
        }
    },
    input:{
        bindings:{},
        keysDown:{},
        previousKeysDown:{},
        bind(key,name){
            this.bindings[key]=name;
        }
    },
    easingMethods:{
        smoothstep(x){return x*x*(3-2*x);},
        smoothstepSquared(x){return Lemon.easingMethods.smoothstep(x)*Lemon.easingMethods.smoothstep(x);},
        smoothstepCubed(x){return Math.pow(Lemon.easingMethods.smoothstep(x),3);},
        acceleration(x){return x*x;},
        accelerationCubed(x){return x*x*x;},
        deceleration(x){return 1-((1-x)*(1-x));},
        decelerationCubed(x){return 1-((1-x)*(1-x)*(1-x));},
        sine(x){return Math.sin(x*Math.PI/2);},
        inverseSine(x){return 1-Math.sin(1-x)*Math.PI/2;},
        linear(x){return x;}
    },

    extend(obj){
        Object.assign(this,obj);
        return this;
    },
    getAll(tag){
        return Lemon.currentScene.entities.filter((e)=>e.is(tag));
    },
    get camX(){
        return Lemon.currentScene.camera.x;
    },
    get camY(){
        return Lemon.currentScene.camera.y;
    },
    get rendering(){
        return Lemon.currentScene.rendering;
    },
    set rendering(value){
        Lemon.currentScene.rendering=value;
    },
    get running(){
        return Lemon.currentScene.running;
    },
    set running(value){
        Lemon.currentScene.running=value;
    }
};

//stuff for cloning and stringifying functions
Lemon.stringify=function(obj){
    return JSON.stringify(obj,function(key,value){
        //adding method/function support to JSON
        return (typeof value=="function")?value.toString():value;
    });
}
Lemon.parse=function(str){
    return JSON.parse(str,function(key, value){
        if(typeof value != 'string'){return value;}
        return ( value.substring(0,8) == 'function') ? eval('('+value+')') : value;
    });
}
Lemon.clone=function(obj) {
    //deep-clone an object including methods
    return Lemon.parse(Lemon.stringify(obj));
}

//initialisation
Lemon.init=function(config){

    Lemon.extend(config);

    Lemon.canvas.width=Lemon.width;
    Lemon.canvas.height=Lemon.height;

    Lemon.canvas.style.width=Lemon.width*Lemon.scale+"px";
    Lemon.canvas.style.height=Lemon.height*Lemon.scale+"px";

    console.log(Lemon.canvas.width+" : "+Lemon.canvas.height);

    Lemon.ctx=Lemon.canvas.getContext("2d");
    Lemon.currentScene=Lemon.scene();

    Lemon.style=document.createElement("style");
    Lemon.style.innerText=Lemon.pixelart?"canvas, img {image-rendering: optimizeSpeed;image-rendering: -moz-crisp-edges;image-rendering: -webkit-optimize-contrast;image-rendering: optimize-contrast;image-rendering: pixelated;-ms-interpolation-mode: nearest-neighbor;} body {margin: 0; height: 100%; overflow: hidden}":"";
    document.body.appendChild(Lemon.style);
    Lemon.initHandlers();

    return this;
}
Lemon.initHandlers=function(){

    document.onkeydown=function(evt){
        if(!Lemon.running)return;
        Lemon.input.keysDown[evt.keyCode]=true;
        Lemon.currentScene.bindings[evt.keyCode]?Lemon.currentScene.bindings[evt.keyCode]():0;
        Lemon.currentScene.onkeydown(evt);
    }
    Lemon.canvas.onclick=function(evt){
        if(!Lemon.running)return;
        Lemon.mouse.screenX=evt.clientX;
        Lemon.mouse.screenY=evt.clientY;

        Lemon.currentScene.onclick(evt);
    }
    Lemon.canvas.onmousedown=function(evt){
        if(!Lemon.running)return;
        Lemon.mouse.isDown=true;
    }
    Lemon.canvas.onmouseup=function(evt){
        if(!Lemon.running)return;
        Lemon.mouse.isDown=false;
    }
    Lemon.canvas.onmousemove=function(evt){
        if(!Lemon.running)return;
        Lemon.mouse.screenX=evt.clientX;
        Lemon.mouse.screenY=evt.clientY;
        Lemon.currentScene.onmousemove(evt);
    }
    document.onkeyup=function(evt){
        if(!Lemon.running)return;
        Lemon.currentScene.onkeyup(evt);
        delete Lemon.input.keysDown[evt.keyCode];
    }
}
Lemon.createCanvas=function(parent=document.body,obj){
    let canvas=document.createElement("canvas");
    Object.assign(canvas,obj||{});
    parent.appendChild(canvas);
    return canvas;
}

//i should probably compress this, its kinda confusing. but i use them all
//in different projects that i dont want to recode the event system of
Lemon.keyDown=function(key){
    if(key=="MOUSE"){
        return Lemon.mouse.isDown;
    }
    return key.charCodeAt(0) in Lemon.input.keysDown;
}
Lemon.pressed=function(name){
    return Lemon.input.bindings[name] in Lemon.input.keysDown;
}
Lemon.keyPressed=function(key){
    return key.charCodeAt(0) in Lemon.input.keysDown&&!(key.charCodeAt(0) in Lemon.input.previousKeysDown);
}
Lemon.keyCodeDown=function(kc){
    return kc in Lemon.input.keysDown;
}
Lemon.updateObj=function(obj){
    obj.update(Lemon.elapsed);
}
Lemon.drawObj=function(obj){
    if(obj.isVisible){
        obj.__draw__();
    }
}

//math assets

Lemon.math.collision=(rect1, rect2)=>{
    return rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.height + rect1.y > rect2.y
}
Lemon.math.randint=(min,max)=>Math.floor(Math.random() * (Math.floor(max+1) - Math.ceil(min))) + Math.ceil(min);
Lemon.math.random=(min,max)=>Math.random() * (max - min) + min;
Lemon.math.distance=function(ent1,ent2){
    let dx=(ent1.x+ent1.width/2)-(ent2.x+ent2.width/2);
    let dy=(ent1.y+ent2.height/2)-(ent2.y+ent2.height/2);
    return Math.sqrt(dx * dx + dy * dy);
}
Lemon.math.vecFromAngle=(a,l=10)=>Lemon.vec(Math.cos(a-90),Math.sin(a-90)).setLength(length)
Lemon.math.angleBetween=(p1,p2)=>(Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI)+90;
Lemon.math.radians=(d)=>d*Math.PI/180;
Lemon.math.degrees=(r)=>r*180/Math.PI;
//loop assets
Lemon.start=function(){

    Lemon.lastStep=Date.now();
    Lemon.rendering=true;
    Lemon.running=true;
    Lemon.step();
    return this;

}
Lemon.onDraw=function(){};
Lemon.onUpdate=function(){};

Lemon.stop=function(){

    Lemon.rendering=false;
    Lemon.running=false;
    cancelAnimationFrame(Lemon.step);
}

Lemon.enterScene=function(scene){

    scene.onEnter();
    if(Lemon.currentScene.soundtrack){
        Lemon.currentScene.soundtrack.stop();
    }
    Lemon.currentScene=scene;
    if(scene.soundtrack){
        scene.soundtrack.loop=true;
        scene.soundtrack.play();
    }
    return this;
}

Lemon.step=function(){
    Lemon.updateTweens();
    Lemon.currentScene.update();
    Lemon.currentScene.draw();
    if(Date.now()-Lemon.lastfixedUpdate>Lemon.fixedUpdateInterval){
        Lemon.lastfixedUpdate=Date.now();
        Lemon.currentScene.fixedUpdate();
    }
    Lemon.input.previousKeysDown=Lemon.clone(Lemon.input.keysDown);
    if(!(Lemon.running||Lemon.rendering))return;
    requestAnimationFrame(Lemon.step);
}
Lemon.updateTweens=function(){
    Lemon.tweens.forEach(Lemon.updateObj);
}
Lemon.loader=Object.create({
    imageExtensions:["png","gif","jpg","jpeg"],
    assets:{},
    extend:Lemon.extend,
    attr:Lemon.attr,
    load(files,callback){
        if(callback){Lemon.loader.onAllLoaded=callback;}

        Lemon.loader.toLoad=files.length;
        Lemon.loader.loaded=0;

        files.forEach(Lemon.loader.loadFile);

        return Lemon.loader;
    },
    loadFile(source){
        let extension=source.split(".")[1];
        let folders=source.split("/");
        let name=folders[folders.length-1].split(".")[0];

        if(Lemon.loader.imageExtensions.includes(extension)){
            let img=Lemon.img(source).attr({
                name:name,onload(){
                    this.ready=true;
                    Lemon.loader.assets[this.name]=this;
                    Lemon.loader.loaded++;
                    if(Lemon.loader.loaded==Lemon.loader.toLoad){
                        Lemon.loader.onAllLoaded();
                    }
                }
            })
        }
        if(extension=="json"){
            let xhr=new XMLHttpRequest();
            xhr.open("GET",source,true);
            xhr.name=name;

            xhr.onreadystatechange=function(){
                if(this.readyState==4&&this.status==200){
                    Lemon.loader.loaded++;
                    Lemon.loader.assets[this.name]=JSON.parse(this.responseText);

                    if(Lemon.loader.loaded==Lemon.loader.toLoad){
                        Lemon.loader.onAllLoaded();
                    }
                }
            }

            xhr.send();
            return xhr;
        }
        if(extension=="wav"){
            let sound=new Audio();
            sound.src=source;
            Lemon.loader.assets[name]=sound;
            Lemon.loader.loaded++;
            if(Lemon.loader.loaded==Lemon.loader.toLoad){
                Lemon.loader.onAllLoaded();
            }
        }
    },
    onAllLoaded(){}
});

Lemon.loadJSON=function(source, callback){
    let xhr=new XMLHttpRequest();
    xhr.open("GET",source,true);
    xhr.callback=callback;

    xhr.onreadystatechange=function(){
        if(this.readyState==4&&this.status==200){
            this.callback(this.responseText);
        }
    }
    xhr.send();
}
Lemon.loadTileset=function(properties){
    let tiles=["NO-TILE"];
    let props=Lemon.clone(properties);
    let folders=properties.image.split("/");
    let name=folders[folders.length-1].split(".")[0];

    if(!(name in Lemon.loader.assets)){
        Lemon.loader.assets[name]=Lemon.img(properties.image);
    }
    props.image=Lemon.loader.assets[name];

    for(let t=0;t<(props.image.width/props.tilewidth)*(props.image.height/props.tileheight);t++){
        let x=(t)%(props.image.width/props.tilewidth); //(t*16)-((t*16)/image.width);
        let y=Math.floor((t)/(props.image.width/props.tilewidth));

        let tile=Lemon.sprite(props.image,x*props.tilewidth,y*props.tileheight,props.tilewidth,props.tileheight);
        tiles.push(tile);
    }
    return tiles;
}
////////////////////////////////////
//classes                         //
////////////////////////////////////

//factory functions working without "new" keyword for a shorter syntax

Lemon.sprite=(img,x,y,w,h)=>new Lemon.classes.Sprite(img,x,y,w,h);
Lemon.animation=(s,l,f)=>new Lemon.classes.Animation(s,l,f);
Lemon.entity=Lemon.ent=Lemon.e=(tags="")=>new Lemon.classes.Entity(tags);
Lemon.c=Lemon.component=n=>new Lemon.classes.Component(n);
Lemon.vec=(x,y)=>new Lemon.classes.Vector(x,y);
Lemon.cam=Lemon.camera=(x,y)=>new Lemon.classes.Camera(x, y);
Lemon.scene=(config)=>new Lemon.classes.Scene(config);
Lemon.sound=src=>new Lemon.classes.Sound(src);
Lemon.tween=(o,p,ev,t,m)=>new Lemon.classes.Tween(o,p,ev,t,m);
Lemon.interval=Lemon.timer=(func,interval)=>new Lemon.classes.Interval(func,interval);

//returns extended image object
Lemon.img=function(path){

    let image=new Image();
    image.src=path;
    image.ready=false;
    image.onload=function(){

        this.ready=true;
    }
    image.draw=function(x, y){
        Lemon.ctx.drawImage(this, x, y);
    }
    image.extend=Lemon.extend;
    image.attr=Lemon.extend;
    console.log(image)
    return image;
}
Lemon.circle=function(radius,color){
    let circle={radius:radius,color:color,draw(x,y){
        Lemon.drawCircle(x,y,this.radius,true,this.color)
    }}
    return circle;
}
Lemon.rectangle=Lemon.rect=function(width,height,color){
    let rect={width:width,height:height,color:color,draw(x,y){
        Lemon.ctx.fillStyle=this.color;
        Lemon.ctx.fillRect(x,y,this.width,this.height)
    }}
    return rect;
}

Lemon.classes.Entity=class{

    constructor(tags){

        this.tags=tags.split(" ");
        //create a unique name
        this.name="Entity#"+Lemon.entityCount;
        Lemon.entityCount++;

        this.x=0;
        this.y=0;
        this.xv=0;
        this.yv=0;
        this.width=16;
        this.height=16;

        this.layer=0;
        this.alpha=1;

        this.components=[];
        this.tweens={};
        this.sprite=null;
        this.isVisible=true;
        this.rotation=0;

        this.hb={width:16,height:16,xOffset:0,yOffset:0};
        this.extend=Lemon.extend;
        this.attr=Lemon.extend;

    }
    onAddedToScene(){}
    input(){}
    onUpdate(){}
    fixedUpdate(){}

    update(elapsed){

        this.timeElapsed=elapsed;
        this.updateComponents();
        this.input();
        this.onUpdate();
        this.updatePos();

    }
    onDraw(){}
    updatePos(){
        this.x+=(this.xv*(Math.max(this.timeElapsed,0.1)/10));
        this.y+=(this.yv*(Math.max(this.timeElapsed,0.1)/10));
    }
    updateComponents(){
        for(let c=0;c<this.components.length;c++){
            if(this.components[c]!=undefined){
                try{this.components[c].update(this);}catch(err){}
            }
        }
    }
    __draw__(){
        Lemon.ctx.globalAlpha=this.alpha;
        if(this.rotation!=0){
            Lemon.ctx.save();
            Lemon.ctx.translate(Math.floor(this.centerX),Math.floor(this.centerY));
            Lemon.ctx.rotate(Lemon.math.radians(this.rotation));
            this.sprite.draw(-(this.sprite.width/2),-(this.sprite.height/2));
            Lemon.ctx.restore();
            return
        }else{
            this.draw();
        }
        this.onDraw();
        Lemon.ctx.globalAlpha=1;
    }
    draw(){
        if(!this.sprite)return;
        //this.sprite.draw(Math.floor(this.x),Math.floor(this.y))
        this.sprite.draw(Math.round(this.centerX-this.sprite.width/2),Math.round(this.centerY-this.sprite.height/2))
    }
    initComponents(){
        this.components=[];
        for(let t=0;t<this.tags.length;t++){
            if(this.tags[t] in Lemon.components){
                this.extend(Lemon.clone(Lemon.components[this.tags[t]].obj));
                this.components.push(Lemon.components[this.tags[t]]);
                Lemon.components[this.tags[t]].init(this);
            }
        }
        return this;
    }
    addToScene(scene){
        scene.entities.push(this);
        this.onAddedToScene(scene);
        return this;
    }
    delFromScene(scene){
        scene.entities.splice(scene.entities.indexOf(this),1);
    }
    collidesWith(tag_){
        let ents=Lemon.getAll("physics")
        for(let e_=0;e_<ents.length;e_++){
            if(ents[e_].is(tag_)&&Lemon.math.collision(this, ents[e_]) && ents[e_] !=this){
                return ents[e_];
            }
        }

        return false;
    }
    vec(vector){
        this.xv=vector.x;
        this.yv=vector.y;

        return this;
    }
    move(x,y){
        this.x+=x;
        this.y+=y;
    }
    is(tag){
        return this.tags.includes(tag);
    }
    clone(){
        return Lemon.e("").extend(Lemon.clone(this));
    }
    blockMovement(tag,priority="Y"){
        //pass a tag as an argument and the entitys movement will be blocked by entities with this tag
        var collisionSide="none";
        Lemon.getAll("physics").forEach((that)=>{
            if(that.is(tag)&&that!=this){

                let overlapX,overlapY

                let vec=Lemon.vec(
                    (this.hitbox.x+this.hitbox.width/2)-(that.hitbox.x+that.hitbox.width/2),
                    (this.hitbox.y+this.hitbox.height/2)-(that.hitbox.y+that.hitbox.height/2)
                );
                let combinedHalfWidths=this.hitbox.width/2+that.hitbox.width/2;
                let combinedHalfHeights=this.hitbox.height/2+that.hitbox.height/2;

                if(Math.abs(vec.x)<combinedHalfWidths){
                    if(Math.abs(vec.y)<combinedHalfHeights){
                        overlapX=Math.floor(combinedHalfWidths-Math.abs(vec.x));
                        overlapY=Math.floor(combinedHalfHeights-Math.abs(vec.y));
                        if(overlapY>overlapX){ 
                            if(vec.x>0){
                                collisionSide="left";
                                this.x+=overlapX;
                            }else{
                                collisionSide="right";
                                this.x-=overlapX
                            }
                        }
                        if(overlapX>overlapY){
                            if(vec.y>0){
                                collisionSide="top";
                                this.y+=overlapY;
                            }else{
                                collisionSide="bottom";
                                this.y-=overlapY;
                            }
                        }
                        if(overlapY==overlapX){
                            //this[priority.toLowerCase()]+={overlapX,overlapY}["overlap"+priority];

                            //for some reason it works best when i do nothing here. else
                            //it sometimes happens that when the overlaps are the same, the entity doesnt move at all.
                            //it works like this, no idea why! xD
                        }
                    }else{
                        return "none";
                    }
                }else{
                    return "none";
                }
            }
        })
        return collisionSide;
    }
    tween(property,to,time,method){
        this.tweens[property]?this.tweens[property].remove():0;
        this.tweens[property]=Lemon.tween(this,property,to,time,method).start();
        return this.tweens[property];
    }
    slide(tox,toy,time,method){
        this.tween("x",tox,time,method);
        this.tween("y",toy,time,method);
        return this;
    }
    lineOfSight(that,blockingTag,accuracy){
        let lineOfSight=true;
        let totalVec=Lemon.vec(that.centerX-this.centerX,that.centerY-this.centerY);
        let vec=Lemon.vec().attr(Lemon.clone(totalVec)).setLength(accuracy);

        let boxCount=totalVec.length/accuracy;

        let validEnts=Lemon.getAll(blockingTag)
        for(let b=0;b<boxCount;b++){
            let e=Lemon.e("").attr({width:1,height:1});
            e.centerX=this.centerX+b*vec.x;
            e.centerY=this.centerY+b*vec.y;
            Lemon.ctx.fillRect(e.x-Lemon.camX,e.y-Lemon.camY,1,1);
            if(Lemon.math.collision(that.hitbox,e)){
                return true;
            }
            if(validEnts.some((ent)=>Lemon.math.collision(ent.hitbox,e))){
                lineOfSight=false;
                return lineOfSight;
            }
        }
        return lineOfSight;

    }
    get onScreen(){
        return Lemon.math.collision({x:this.x-Lemon.camX,y:this.y-Lemon.camY,width:this.width,height:this.height},{x:0,y:0,width:Lemon.width,height:Lemon.height})
    }
    get inWorld(){
        return Lemon.math.collision({x:this.x,y:this.y,width:this.width,height:this.height},{x:0,y:0,width:Lemon.currentScene.width,height:Lemon.currentScene.height})
    }
    get hitbox(){
        return {
            x:this.x+this.hb.xOffset,
            y:this.y+this.hb.yOffset,
            width:this.hb.width,
            height:this.hb.height
        }
    }
    set hitbox(value){
        Object.assign(this.hb,value);
    }
    get centerX(){
        return this.x+this.width/2;
    }
    set centerX(value){
        this.x=value-(this.width/2);
    }
    get centerY(){
        return this.y+this.height/2;
    }
    set centerY(value){
        this.y=value-(this.height/2);
    }
    get pivotX(){
        return this.centerX;
    }
    get pivotY(){
        return this.centerY;
    }
    get vx(){
        return this.xv;
    }
    set vx(value){
        this.xv=value;
    }
    get vy(){
        return this.yv;
    }
    set vy(value){
        this.yv=value;
    }
    get w(){
        return this.width;
    }
    set w(value){
        this.width=value;
    }
    get h(){
        return this.height;
    }
    set h(value){
        this.height=value;
    }
    get cx(){
        return this.centerX;
    }
    set cx(value){
        this.centerX=value;
    }
    get cy(){
        return this.centerY;
    }
    set cy(value){
        this.centerY=value;
    }
    get center(){
        return {x:this.cx,y:this.cy};
    }
    set center(value){
        this.cx=value.x;
        this.cy=value.y;
    }

}
Lemon.classes.Tween=class{

    constructor(object,property,endValue,time,easingMethod="smoothstep"){
        this.object=object;
        this.property=property;

        this.totalTime=time;
        this.currentTime=0;

        this.endValue=endValue;
        this.startValue=JSON.parse(JSON.stringify(this.object[this.property]));
        this.easingMethod=easingMethod;

        this.extend=this.attr=Lemon.extend;

        Lemon.tweens.push(this);

    }
    update(){
        if(this.running){
            this.currentTime=Date.now()-this.startTime;
            if(this.currentTime<this.totalTime){
                let normalizedTime=this.currentTime/this.totalTime;
                let curvedTime=Lemon.easingMethods[this.easingMethod](normalizedTime);

                this.object[this.property]=(this.endValue*curvedTime)+(this.startValue*(1-curvedTime));
                //this.currentTime++;
            }else{
                this.stop();
                this.onEnded();
            }
        }
    }
    remove(){
        Lemon.tweens.splice(Lemon.tweens.indexOf(this),1);
        if((this.object.tweens||{})[this.property]){
            delete this.object.tweens[this.property];
        }
    }
    start(){
        this.startTime=Date.now();
        this.running=true;
        return this;
    }
    stop(){
        this.running=false;
    }
    onEnded(){
        this.remove();
    }
}
Lemon.classes.Sound=class{
    constructor(src){
        this.sound=new Audio();
        this.sound.src=src;

        this.sound.onended=function(){
            if(this.loop){
                this.currentTime=0;
                this.play();
            }
        }
    }

    play(){
        let isPlaying = this.sound.currentTime > 0 && !this.sound.paused && !this.sound.ended && this.sound.readyState > 2;

        if (!isPlaying) {
            this.sound.play();
        }
    }
    stop(){
        try{
            this.sound.pause();
            this.sound.currentTime=0;
        }catch(err){}
    }
    set loop(value){
        this.sound.loop=value;
    }
    get loop(){
        return this.sound.loop;
    }

};
Lemon.classes.Sprite=class{
    constructor(img,x=0,y=0,width=16,height=16){
        this.img=img;
        this.x=x;
        this.y=y;
        this.width=width;
        this.height=height;

        this.extend=Lemon.extend;
        this.attr=Lemon.extend;
    }
    
    draw(x,y){
        if(this.img&&this.img.ready){
            Lemon.ctx.drawImage(
                this.img,
                this.x,
                this.y,
                this.width,
                this.height,
                x,y,
                this.width,
                this.height
            );
        }
        return this;
    }
    get w(){
        return this.width;
    }
    set w(v){
        this.width=v;
    }
    get h(){
        return this.height;
    }
    set h(v){
        this.height=v;
    }
};
Lemon.classes.Scene=class{

    constructor(config={}){
        this.name="Scene#"+Lemon.sceneCount;
        Lemon.sceneCount++;

        this.camera=Lemon.cam(0,0);
        this.entities=[];
        this.tweens=[];
        this.intervals=[];
        this.bindings={};

        this.rendering=true;
        this.running=true;

        this.width=this.height=2000;

        this.extend=Lemon.extend;
        this.attr=Lemon.extend;
        this.extend(config);

    }
    onclick(){}
    onkeydown(){}
    onkeyup(){}
    onmousemove(){}
    onUpdate(){}
    onDraw(){}
    bind(key,func){
        this.bindings[key]=func;
    }
    onEnter(){}
    setCam(cam){
        this.camera=cam;
        return this;
    }
    //rendering
    draw(){
        if(this.rendering){
            Lemon.ctx.save();
            Lemon.ctx.translate(-Math.round(Lemon.camX),-Math.round(Lemon.camY));
            Lemon.ctx.clearRect(0,0,Lemon.width+Lemon.camX,Lemon.height+Lemon.camY);
            this.drawBackground();
            this.drawEntities();
            this.drawForeground();
            this.onDraw();
            Lemon.ctx.restore();
        }
    }
    drawBackground(){
        if(this.background&&this.background.ready){
            this.background.draw(0,0);
        }
        if(typeof this.background=="string"){
            Lemon.ctx.fillStyle=this.background;
            Lemon.ctx.fillRect(Lemon.camX,Lemon.camY,Lemon.width,Lemon.height);
        }
    }
    drawForeground(){
        if(this.foreground&&this.foreground.ready){
            this.foreground.draw(0,0);
        }
        if(typeof this.foreground=="string"){
            Lemon.ctx.fillStyle=this.foreground;
            Lemon.ctx.fillRect(0,0,Lemon.width,Lemon.height);
        }
    }
    drawEntities(){
        this.entities.sort(this.renderingOrder);
        this.entities.forEach(Lemon.drawObj);
    }
    renderingOrder(a,b){
        if(a.layer>b.layer){return 1;}
        if(b.layer>a.layer){return -1;}
        if(a.y+a.height/2==b.y+b.height/2){
            if(a.drawPriority){
                return 1;
            }else{
                return -1;
            }
        }
        if(a.y+a.height/2>b.y+b.height/2){
            return 1;
        }else{
            return -1;
        }
    }
    //updating
    update(){
        if(this.running){
            Lemon.elapsed=Date.now()-Lemon.lastStep;
            Lemon.lastStep=Date.now();
            this.onUpdate();
            this.intervals.forEach(i=>i.update())
            this.updateEntities();
        }
    }
    fixedUpdate(){
        this.entities.forEach(e=>e.fixedUpdate());
    }
    updateEntities(){
        this.entities.forEach(Lemon.updateObj);
        Lemon.animations.forEach(Lemon.updateObj);
    }
    loadTiledMap(map,props={}){
        this.attr({
            width:map.width*map.tilewidth,height:map.height*map.tileheight,
            tilewidth:map.tilewidth,tileheight:map.tileheight,
            layers:{},objects:[],name:map.name
        });
        this.tileset=Lemon.loadTileset(map.tilesets[0]);
        map.layers.forEach((layer,layerIndex)=>{
            this.layers[layer.name]=[];
            if(layer.type=="objectgroup"){
                layer.objects.forEach((obj)=>{
                    let o=Lemon.e("object "+layer.name+" "+props[layer.name]||""+" "+obj.properties.type||"").initComponents()
                    .attr(obj)
                    .attr({layer:layerIndex})
                    .attr(obj.properties)
                    .addToScene(this);
                    this.layers[layer.name].push(o);
                })
                return;
            }
            layer.data.forEach((t,i)=>{
                if(t==0){return;}
                let x=((i)%(map.width))*this.tilewidth;
                let y=(Math.floor((i)/(map.width)))*this.tileheight;

                let tile__=Lemon.e("tile "+layer.name+" "+props[layer.name]||"")
                .attr({x:x,y:y,
                    width:this.tilewidth,height:this.tileheight,
                    layer:layerIndex,sprite:this.tileset[t],
                    hitbox:{xOffset:0,yOffset:0,width:this.tilewidth,height:this.tileheight}
                }).initComponents()
                .addToScene(this);
                this.layers[layer.name].push(tile__);
            })
        })
        return this;
    }
    setInterval(func,interval){
        let i=Lemon.interval(func,interval).start();
        this.add(i);
        return i;
    }
    add(a){
        if(a instanceof Array){
            a.forEach(e=>e.addToScene(this));
            return;
        }
        a.addToScene(this);
    }
    remove(a){
        if(a instanceof Array){
            a.forEach(e=>e.addToScene(this))
            return;
        }
        a.delFromScene(this);
    }
}
Lemon.classes.Interval=class{
    constructor(func,interval){
        this.func=func;
        this.interval=interval;
        this.lastUpdated=0;
        this.running=false;
    }
    start(){
        this.lastUpdated=Date.now();
        this.running=true;
        return this;
    }
    stop(){
        this.running=false;
        return this;
    }
    update(){
        if(!this.running)return;
        if(Date.now()-this.lastUpdated>this.interval){
            this.func();
            this.lastUpdated=Date.now();
        }
    }
    addToScene(s){
        s.intervals.push(this);
    }
    delFromScene(s){
        s.intervals.slice(s.intervals.indexOf(this),1)
    }
}
Lemon.classes.Camera=class{

    constructor(x,y){
        this.x=x;
        this.y=y;

        this.width=Lemon.width;
        this.height=Lemon.height;

        this.trapSize=0.5;

        this.extend=this.attr=Lemon.extend;
    }
    
    lookAt(x,y){
        this.x=x-(Lemon.canvas.width/2);
        this.y=y-(Lemon.canvas.height/2);
        if(this.x<0){this.x=0;}
        if(this.x>Lemon.currentScene.width-this.width){this.x=Lemon.currentScene.width-this.width;}
        if(this.y<0){this.y=0;}
        if(this.y>Lemon.currentScene.height-this.height){this.y=Lemon.currentScene.height-this.height;}
    }
    move(x,y){
        this.x+=x;
        this.y+=y;
    }
    follow(ent){
        if(ent.x<this.leftInnerBoundary){
            this.x=Math.floor(ent.x-(this.width*(0.5-this.trapSize/2)));
        }
        if(ent.y<this.topInnerBoundary){
            this.y=Math.floor(ent.y-(this.height*(0.5-this.trapSize/2)));
        }
        if(ent.x+ent.width>this.rightInnerBoundary){
            this.x=Math.floor(ent.x+ent.width-(this.width*(0.5+this.trapSize/2)));
        }
        if(ent.y+ent.height>this.bottomInnerBoundary){
            this.y=Math.floor(ent.y+ent.height-(this.height*(0.5+this.trapSize/2)));
        }
        if(this.x<0){this.x=0;}
        if(this.x>Lemon.currentScene.width-this.width){this.x=Lemon.currentScene.width-this.width;}
        if(this.y<0){this.y=0;}
        if(this.y>Lemon.currentScene.height-this.height){this.y=Lemon.currentScene.height-this.height;}
    }
    get rightInnerBoundary(){
        return this.x+(this.width*(0.5+this.trapSize/2));
    }
    get leftInnerBoundary(){
        return this.x+(this.width*(0.5-this.trapSize/2));
    }
    get topInnerBoundary(){
        return this.y+(this.height*(0.5-this.trapSize/2));
    }
    get bottomInnerBoundary(){
        return this.y+(this.height*(0.5+this.trapSize/2));
    }
};
Lemon.classes.Component=class{

    constructor(name){
        this.name=name;
        this.obj={};

        this.extend=Lemon.extend;
        this.attr=Lemon.extend;
        Lemon.components[this.name]=this;
        
    }
    update(entity){}
    init(entity){}
};
Lemon.classes.Animation=class{
    constructor(sprite,length,frameDuration=100){
        this.sprite=sprite;
        this.currentFrame=0;
        this.length=length-1;
        this.running=false;
        this.frameDuration=frameDuration;
        this.loop=true;

        this.onended=function(){
            if(this.loop){
                this.currentFrame=0;
                this.running=true;
            }
        }
        this.attr=Lemon.extend;
        this.extend=Lemon.extend;
        Lemon.animations.push(this);
    }
    update(){
        if(this.running){
            if(Date.now()-this.lastUpdated>this.frameDuration){
                if(this.currentFrame>this.length){
                    this.running=false;
                    this.stop();
                    this.onended();
                }
                this.sprite.x=this.sprite.width*this.currentFrame;
                this.currentFrame++;
                this.lastUpdated=Date.now();
            }
        }
    }
    run(){
        this.lastUpdated=Date.now();
        this.update();
        this.running=true;
        return this;
    }
    play(){
        this.lastUpdated=Date.now();
        this.running=true;
        this.currentFrame=0;
        this.sprite.x=0;
        return this;
    }
    stop(){
        this.running=false;
        this.currentFrame=0;
    }
};
Lemon.classes.Vector=class{
    constructor(x,y){
        this.x=x;
        this.y=y;

        this.extend=Lemon.extend;
        this.attr=Lemon.extend;
    }
    setLength(newlength){
        let l=this.length;
        this.x/=l;
        this.y/=l;
        this.x*=newlength;
        this.y*=newlength;

        return this;
    }
    get length(){
        return Math.sqrt(this.x*this.x+this.y*this.y);
    }
    set length(value){
        this.setLength(value);
    }
}
Lemon.particle=function(opts){
    let vec=Lemon.vec(Lemon.math.random(opts.minXV,opts.maxXV),Lemon.math.random(opts.minYV,opts.maxYV))
    return Lemon.e("particle").extend({
        x:0,y:0,minXV:-5,minYV:-5,maxXV:5,maxYV:5,maxSpeed:5,sprite:Lemon.rectangle(2,2,"grey"),lifetime:300,onUpdate(){
        this.alpha=1-(Date.now()-this.created)/this.lifetime;
        //this.rotation+=0.5;
        },layer:0
    }).extend(opts).extend({
        created:Date.now(),
        input(){
            if(Date.now()-this.created>this.lifetime){
                this.delFromScene(Lemon.currentScene);
            }
        }
    })
    .vec(vec.setLength(Math.min(opts.maxSpeed,vec.length)))
    .addToScene(Lemon.currentScene);
}
Lemon.particleEffect=function(opts,amount){
    for(let p=0;p<amount;p++){
        Lemon.particle(opts);
    }
}
Lemon.drawCircle=function(x,y,radius,fill,color="black"){
    Lemon.ctx.beginPath();
    Lemon.ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    Lemon.ctx.fillStyle=color;
    fill?Lemon.ctx.fill():Lemon.ctx.stroke();
}
/*Lemon.circle=function(x,y,radius){
    Lemon.ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
}*/
Lemon.darkMask=function(x,y,radius){
    Lemon.ctx.save();
    Lemon.ctx.globalCompositeOperation="multiply";
    Lemon.ctx.globalAlpha=0.8;
    rnd=0.05*Math.sin(1.1*Date.now()/1000);

    radius=radius*(1+rnd);
    let gradient=Lemon.ctx.createRadialGradient(x,y,0,x,y,radius);
    gradient.addColorStop(0.0,"rgba(0,0,0,0.1)");
    gradient.addColorStop(0.4,"rgba(0,0,0,0.7)");
    gradient.addColorStop(1,"rgba(0,0,0,1)");
    Lemon.ctx.fillStyle=gradient;
    Lemon.ctx.beginPath();
    Lemon.ctx.arc(x,y,radius,0,2*Math.PI);
    Lemon.ctx.fill();
    Lemon.ctx.restore();
}
Lemon.lighten=function(x,y,radius){
    Lemon.ctx.save();
    Lemon.ctx.globalCompositeOperation="lighten";
    Lemon.ctx.globalAlpha=0.4;
    rnd=0.05*Math.sin(1.1*Date.now()/1000);

    radius=radius*(1+rnd);
    let gradient=Lemon.ctx.createRadialGradient(x,y,0,x,y,radius);
    gradient.addColorStop(0.0,"rgba(255,255,255,0.8)");
    gradient.addColorStop(0.6,"rgba(255,255,255,0.5)");
    gradient.addColorStop(1,"rgba(0,0,0,0.1)");
    Lemon.ctx.fillStyle=gradient;
    Lemon.ctx.beginPath();
    Lemon.ctx.arc(x,y,radius,0,2*Math.PI);
    Lemon.ctx.fill();
    Lemon.ctx.restore();
    Lemon.ctx.globalAlpha=1;
}
Lemon.screenshot=function(x=0,y=0,width=Lemon.height,height=Lemon.height){
    let data=Lemon.ctx.getImageData(x,y,width,height);
    data.draw=function(x,y){
        Lemon.ctx.putImageData(this,x,y);
    }
    return data;
}
//letter => keyCode dictionary
Lemon.input.key={
    W : 87,
    D : 68,
    S : 83,
    A : 65,
    E : 69,
    Q : 81,
    R : 82,
    T : 84,
    Z : 90,
    U : 85,
    I : 73,
    O : 79,
    P : 80,
    F : 70,
    G : 71,
    H : 72,
    J : 74,
    K : 75,
    L : 76,
    Y : 89,
    X : 88,
    C : 67,
    V : 86,
    B : 66,
    N : 78,
    M : 77,
    ESCAPE : 27,
    SPACE : 32,
    SHIFT : 16
};

//Components
Lemon.c("text").attr({
    obj:{
        draw: function(){
            Lemon.ctx.fillStyle=this.color;
            Lemon.ctx.font=this.font;
            Lemon.ctx.textAlign=this.align;
            Lemon.ctx.fillText(this.text, this.x-Lemon.camX, this.y-Lemon.camY);
            if(this.stroke){
                Lemon.ctx.fillStyle=this.strokeColor;
                Lemon.ctx.strokeText(this.text, this.x, this.y);
            }
        },
        font:"10px Arial",
        color:"white",
        strokeColor:"black",
        text:"LemonJS text component standard",
        align:"center",
        stroke:false
    }
});
Lemon.c("flickering").attr({
    update(entity){

        entity.state+=entity.timeElapsed;
        if(entity.state<entity.interval){
            entity.isVisible=true;
        }else{
            entity.isVisible=false;
        }
        if(entity.state>entity.interval*2){
            entity.state=0;
        }

    },
    obj:{
        interval:1000,
        state:0
    }
});
Lemon.c("color").attr({
    obj:{
        color:"black",
        draw(){
            Lemon.ctx.fillStyle=this.color;
            if(this.fixedToCamera){
                Lemon.ctx.fillRect(this.x,this.y,this.width,this.height);
            }else{
                Lemon.ctx.fillRect(this.x-Lemon.camX,this.y-Lemon.camY,this.width,this.height);
            }
        }
    }
});