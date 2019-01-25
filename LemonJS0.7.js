////////////////////////////////////////////////////////////////
//LemonJS 0.7                                                 //
////////////////////////////////////////////////////////////////
/*
MIT License

Copyright (c) 2019 Moritz Amando Clerc(@pixldemon)

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
 -scenegraph
 -entity system(create and manage entities, define components)
 -sprites
 -animations
 -input handling
 -some game math
 -tweening
 -tilesets
 -load tiled worlds in tiled editor format
 -an universal asset loader
 -some vector math
 -spritefonts
 -advanced camera movement
 -lineofsight algorythm
 -more, smaller stuff

NOTE: This engine is written with customizability in mind. Entities have many methods, you can overwrite them to
change the entities behavior.
It is advised to put the collision logic into the updatePos method of every entitiy, right after
you update its position. Other logic and behavior code can be put into onupdate, it is not used by the engine itself so
do with it whatever you want. Also, the input method is meant to be completely rewritten to handle user input in it.
for example:

player.input=()=>{
    this.xv=this.yv=0;
    if(Lemon.keyDown("A")){
        this.xv=-this.speed;
    }
    if(Lemon.keyDown("W")){
        this.yv=-this.speed;
    }
    if(Lemon.keyDown("D")){
        this.xv=this.speed;
    }
    if(Lemon.keyDown("S")){
        this.xv=this.speed;
    }
}
player.updatePos=()=>{
    this.x+=this.xv*(Lemon.dt/10)
    this.y+=this.yv*(Lemon.dt/10)

    this.blockMovement("barriers");
}

for a WASD controlled player entity that is unable to move through entities with the tag "barriers" in their "tags" array.
a barrier could be created by loading a tilemap with a layer called "barriers", (with all the walls in it) or with the following line of code:

let barrier=Lemon.e("body barriers").attr({coordinates and dimensons}).addToScene(yourGameScene);

Pass the tag "body"(or whatever youve set Lemon.bodyTag to) to every entity you want the blockMovement/lineOfSight method to check, even if it has the tag you passed to blockMovement.
I would advise using that for your own collision checks too, because it reduces the overall entities to check and is quicker than mapping a new array with valid entities.
All the entities that have that tag can also be found in the "bodies" array that every scene has.
*/

let Lemon={
    classes:{},
    math:{},
    components:{},
    gamepads:{},
    animations:[],
    tweens:[],
    entityCount:0,
    sceneCount:0,
    scale:1,
    lastStep:0,
    fixedUpdateInterval:1000/40,
    lastfixedUpdate:0,
    pixelart:true,
    pixelPerfectRendering:true,
    hideCursor:false,
    showfps:false,
    fps:0,
    bodyTag:"body",
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
    },
    get dt(){
        return Lemon.elapsed;//Date.now()-Lemon.lastStep;
    },
    set dt(value){
        Lemon.elapsed=value;
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
    
    Lemon.canvas.id="Lemongamecanvas";

    Lemon.canvas.style.width=Lemon.width*Lemon.scale+"px";
    Lemon.canvas.style.height=Lemon.height*Lemon.scale+"px";

    console.log(Lemon.canvas.width+" : "+Lemon.canvas.height);

    Lemon.ctx=Lemon.canvas.getContext("2d");
    Lemon.currentScene=Lemon.scene();

    Lemon.style=document.createElement("style");
    Lemon.style.innerText=Lemon.pixelart?"canvas, img {image-rendering: optimizeSpeed;image-rendering: -moz-crisp-edges;image-rendering: -webkit-optimize-contrast;image-rendering: optimize-contrast;image-rendering: pixelated;-ms-interpolation-mode: nearest-neighbor;} body {margin: 0; height: 100%; overflow: hidden}":"";
    if(Lemon.pixelart){
        Lemon.ctx.imageSmoothingEnabled=false;
    }
    if(Lemon.hideCursor){
        Lemon.style.innerText+="canvas {cursor:none;}";
    }
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
    Lemon.canvas.addEventListener("mousemove",function(evt){
        evt.preventDefault();
        if(!Lemon.running)return;
        Lemon.mouse.screenX=evt.clientX;
        Lemon.mouse.screenY=evt.clientY;
        Lemon.currentScene.onmousemove(evt);
    },true)
    document.onkeyup=function(evt){
        if(!Lemon.running)return;
        Lemon.currentScene.onkeyup(evt);
        delete Lemon.input.keysDown[evt.keyCode];
    }
    window.addEventListener("gamepadconnected",function(e) {
        var gp=navigator.getGamepads()[e.gamepad.index];
        console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
        gp.index,gp.id,
        gp.buttons.length, gp.axes.length);
        Lemon.gamepads[gp.index]=Lemon.gamepad(gp.index);
        Lemon.currentScene.ongamepadconnect(gp);
    });
    window.addEventListener("gamepaddisconnected",function(e){
        delete Lemon.gamepads[e.gamepad.index];
        console.log("Gamepad with index "+gamepad.index+" disconnected.")
        Lemon.currentScene.ongamepaddisconnect(e.gamepad);
    });
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
    rect1.height + rect1.y > rect2.y;
}
Lemon.math.randint=(min,max)=>Math.floor(Math.random() * (Math.floor(max+1) - Math.ceil(min))) + Math.ceil(min);
Lemon.math.random=(min,max)=>Math.random() * (max - min) + min;
Lemon.math.distance=function(ent1,ent2){
    let dx=(ent1.x+ent1.width/2)-(ent2.x+ent2.width/2);
    let dy=(ent1.y+ent2.height/2)-(ent2.y+ent2.height/2);
    return Math.sqrt(dx * dx + dy * dy);
}
Lemon.math.vecFromAngle=(a,l=10)=>{a=Lemon.math.radians(a-90);return Lemon.vec(Math.cos(a),Math.sin(a)).setLength(l)};
Lemon.math.angleBetween=(p1,p2)=>(Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI)+90;
Lemon.math.radians=(d)=>d*Math.PI/180;
Lemon.math.degrees=(r)=>r*180/Math.PI;
Lemon.math.vecFromTo=(f,t)=>Lemon.vec(t.cx-f.cx,t.cy-f.cy);
//loop assets
Lemon.start=function(){

    Lemon.lastStep=Date.now();
    Lemon.rendering=true;
    Lemon.running=true;
    Lemon.step();
    return this;

}
Lemon.ondraw=function(){};
Lemon.onupdate=function(){};

Lemon.stop=function(){

    Lemon.rendering=false;
    Lemon.running=false;
    cancelAnimationFrame(Lemon.step);
}

Lemon.enterScene=function(scene){

    scene.onenter();
    Lemon.currentScene=scene;
    return this;
}

Lemon.step=function(){
    Lemon.updateTweens();
    let dt=Lemon.dt;
    Lemon.currentScene.update();
    while(dt>1000/60){
        Lemon.currentScene.update();
        dt-=1000/60;
    }
    Lemon.currentScene.draw();
    Lemon.input.previousKeysDown=Lemon.clone(Lemon.input.keysDown);
    Lemon.lastStep=Date.now();
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
    let props=JSON.parse(JSON.stringify(properties));
    let folders=properties.image.split("/");
    let name=folders[folders.length-1].split(".")[0];

    if(!(name in Lemon.loader.assets)){
        Lemon.loader.assets[name]=Lemon.img(properties.image);
    }
    props.image=Lemon.loader.assets[name];

    for(let t=0;t<(props.image.width/props.tilewidth)*(props.image.height/props.tileheight);t++){
        let x=(t)%(props.image.width/props.tilewidth);
        let y=Math.floor((t)/(props.image.width/props.tilewidth));

        let tile=Lemon.sprite(props.image,x*props.tilewidth,y*props.tileheight,props.tilewidth,props.tileheight);
        tiles.push(tile);
    }
    return tiles;
}
Lemon.lastFpsUpdate=0;
Lemon.minFps=Infinity;
Lemon.maxFps=0;
Lemon.frames=0;
Lemon.allfpssum=0;
Lemon.drawFps=function(){
    if(Date.now()-Lemon.lastFpsUpdate>10){
        Lemon.fps=Math.round(1000/Math.max(1,Lemon.dt));
        Lemon.lastFpsUpdate=Date.now();
        if(Lemon.fps>Lemon.maxFps){
            Lemon.maxFps=Lemon.fps;
        }
        if(Lemon.fps<Lemon.minFps){
            Lemon.minFps=Lemon.fps;
        }
        Lemon.frames++;
        Lemon.allfpssum+=Lemon.fps;
        Lemon.avgFps=Math.round(Lemon.allfpssum/Lemon.frames);
    }
    Lemon.ctx.fillStyle="white";
    Lemon.ctx.fillText("FPS: "+Lemon.fps+" AVG:"+Lemon.avgFps+" MIN: "+Lemon.minFps+" MAX: "+Lemon.maxFps, 20+Lemon.camX,20+Lemon.camY);
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
Lemon.spritefont=(img,lw,lh,ss)=>new Lemon.classes.Spritefont(img,lw,lh,ss);
Lemon.gamepad=p=>new Lemon.classes.GamePad(p);

//returns extended image object
Lemon.img=function(path,scale=1){

    let image=new Image();
    image.src=path;
    image.ready=false;
    image.scale=scale;
    image.onload=function(){

        this.ready=true;
    }
    image.draw=function(x, y){
        Lemon.ctx.drawImage(this,x,y,this.width*this.scale,this.height*this.scale);
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

        this.hb={width:this.width,height:this.height,xOffset:0,yOffset:0};
        this.useCustomHitbox=true;
        this.extend=Lemon.extend;
        this.attr=Lemon.extend;

    }
    onaddedtoscene(){}
    input(){}
    onupdate(){}
    fixedUpdate(){
        this.xv*=Lemon.currentScene.friction;
        this.yv*=Lemon.currentScene.friction;
    }

    update(elapsed){

        this.timeElapsed=elapsed;
        this.updateComponents();
        this.input();
        this.onupdate();
        this.updatePos();

    }
    ondraw(){}
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
        this.drawPosition={
            x:Lemon.pixelPerfectRendering?Math.round(this.centerX):this.centerX,
            y:Lemon.pixelPerfectRendering?Math.round(this.centerY):this.centerY
        }
        Lemon.ctx.globalAlpha=this.alpha;
        if(this.rotation!=0){
            Lemon.ctx.save();
            Lemon.ctx.translate(this.drawPosition.x,this.drawPosition.y);
            Lemon.ctx.rotate(Lemon.math.radians(this.rotation));
            this.sprite.draw(-(this.sprite.width/2),-(this.sprite.height/2));
            Lemon.ctx.restore();
            return
        }else{
            this.draw();
        }
        this.ondraw();
        Lemon.ctx.globalAlpha=1;
    }
    draw(){
        if(!this.sprite)return;
        //this.sprite.draw(Math.floor(this.x),Math.floor(this.y))
        this.sprite.draw(this.drawPosition.x-this.sprite.width/2,this.drawPosition.y-this.sprite.height/2);
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
        this.onaddedtoscene(scene);
        scene.updateBodyList();
        return this;
    }
    delFromScene(scene){
        scene.entities.splice(scene.entities.indexOf(this),1);
        scene.updateBodyList();
        return this;
    }
    collidesWith(tag_){
        let ents=Lemon.currentScene.entities;//Lemon.getAll("physics")
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
        Lemon.currentScene.bodies.forEach((that)=>{
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
                        overlapX=combinedHalfWidths-Math.abs(vec.x);
                        overlapY=combinedHalfHeights-Math.abs(vec.y);
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

                            //works best when i do nothing here.
                            //else it sometimes happens that when the overlaps are the same, the entity doesnt move at all.
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
    lineOfSight(that,blockingTag,accuracy,useCustomHitbox=false){
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
            if(validEnts.some((ent)=>(Lemon.math.collision(useCustomHitbox?ent.hitbox:ent,e)&&!(ent==this||ent==that)))){
                lineOfSight=false;
                return lineOfSight;
            }
            if(Lemon.math.collision(that.hitbox,e)){
                return true;
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
        return this.useCustomHitbox?{
            x:this.x+this.hb.xOffset,
            y:this.y+this.hb.yOffset,
            width:this.hb.width,
            height:this.hb.height
        }:{
            x:this.x,
            y:this.y,
            width:this.width,
            height:this.height
        };
    }
    set hitbox(value){
        Object.assign(this.hb,value);
    }
    get center(){
        return {x:this.cx,y:this.cy,width:1,height:1}
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
Lemon.classes.GamePad=class{
    constructor(gamepadIndex){
        this.index=gamepadIndex;
        this.attr=Lemon.extend;
        this.extend=Lemon.extend;

        let gp=navigator.getGamepads()[this.index];

        this.buttons=gp.buttons;
        this.previousButtons=gp.buttons;
    }
    buttonDown(button){
        return this.buttons[button];
    }
    buttonPressed(button){
        //console.log(this.buttons[button].pressed&&!this.previousButtons[button].pressed);
        return this.buttons[button]&&!this.previousButtons[button];
    }
    update(){
        let gp=navigator.getGamepads()[this.index]

        this.previousButtons=[];
        for(let b=0;b<this.buttons.length;b++){
            this.previousButtons[b]=this.buttons[b];
        }

        this.buttons=[];
        for(let b=0;b<gp.buttons.length;b++){
            this.buttons[b]=gp.buttons[b].pressed;
        }
        this.previousAxes=this.axes||{};
        this.axes=JSON.parse(JSON.stringify(gp.axes));

        if(this.previousButtons[2]!=this.buttons[2]){
            console.log("X")
        }
    }
    joystick(index){
        index==0?{x:this.axes[0],y:this.axes[1]}:{x:this.axes[2],y:this.axes[3]}
    }
}
Lemon.classes.Spritefont=class{
    constructor(img,letterwidth,letterheight,spacesize=1){
        this.attr=this.extend=Lemon.extend;
        this.attr({img,letterwidth,letterheight,spacesize});
        this.symbols=[];
        this.order="abcdefghijklmnopqrstuvwxyz.!?0123456789:,";
    }
    init(){
        for(let y=0;y<this.img.height;y+=this.letterheight){
            for(let x=0;x<this.img.width;x+=this.letterwidth){
                let s=Lemon.sprite(this.img,x,y,this.letterwidth,this.letterheight);
                this.symbols.push(s);
            }
        }
        return this;
    }
    write(text,x,y,align="right",offset=0){
        this.text=text.toLowerCase();
        if(align=="right"){
            this.originalX=x;
            this.currentX=x;
        }
        if(align=="center"){
            this.currentX=x-(this.text.length*(this.letterwidth+offset)/2);
            this.originalX=this.currentX;
        }
        this.currentY=y;
        for(let l=0;l<this.text.length;l++){
            if(!(this.text[l]=="\n")&&!(this.text[l]==" ")){
                this.symbols[this.order.indexOf(this.text[l])].draw(this.currentX,this.currentY);
                this.currentX+=this.letterwidth+offset;
            }else{
                if(this.text[l]==" "){
                    this.currentX+=this.spacesize;
                }else{
                    this.currentY+=this.letterheight+1;
                    this.currentX=this.originalX;
                }
            }
        }
    }
}
Lemon.classes.Tween=class{

    constructor(object,property,endValue,time,easingMethod="smoothstep",endValueObject=false,endValueProperty=false){
        this.object=object;
        this.property=property;
        this.to=endValue;

        this.totalTime=time;
        this.currentTime=0;

        //this.endValue=endValue;
        this.startValue=JSON.parse(JSON.stringify(this.object[this.property]));
        this.easingMethod=easingMethod;

        this.extend=this.attr=Lemon.extend;

        this.endValueObject=endValueObject;
        this.endValueProperty=endValueProperty;
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
                this.onended();
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
    onended(){
        this.object[this.property]=this.endValue;
        this.remove();
    }
    get endValue(){
        return this.to;
        return (this.endValueObject&&this.endValueProperty)?this.endValueObject[this.endValueProperty]:this.to;
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
        let isPlaying=this.sound.currentTime>0&&!this.sound.paused&&!this.sound.ended&&this.sound.readyState>2;

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
                this.width*this.img.scale,
                this.height*this.img.scale
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
        this.friction=1;

        this.extend=Lemon.extend;
        this.attr=Lemon.extend;
        this.extend(config);

    }
    onclick(){}
    onkeydown(){}
    onkeyup(){}
    onmousemove(){}
    onupdate(){}
    ondraw(){}
    input(){}
    ongamepadconnect(){}
    ongamepaddisconnect(){}
    bind(key,func){
        this.bindings[key]=func;
    }
    onenter(){}
    setCam(cam){
        this.camera=cam;
        return this;
    }
    //rendering
    draw(){
        if(this.rendering){
            Lemon.ctx.save();
            Lemon.ctx.translate(Lemon.pixelPerfectRendering?-Math.round(Lemon.camX):-Lemon.camX,Lemon.pixelPerfectRendering?-Math.round(Lemon.camY):-Lemon.camY);
            Lemon.ctx.clearRect(0,0,Lemon.width+Lemon.camX,Lemon.height+Lemon.camY);
            this.drawBackground();
            this.drawEntities();
            this.drawForeground();
            Lemon.showfps?Lemon.drawFps():0;
            this.ondraw();
            Lemon.ctx.restore();
        }
    }
    drawBackground(){
        if(this.background&&(this.background.img?this.background.img.ready:this.background.ready)){
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
            this.updateGamepads();
            this.input();
            this.onupdate();
            this.intervals.forEach(i=>i.update())
            this.updateEntities();
            if(Date.now()-Lemon.lastfixedUpdate>Lemon.fixedUpdateInterval){
                Lemon.lastfixedUpdate=Date.now();
                this.fixedUpdate();            }
        }
    }
    fixedUpdate(){
        this.entities.forEach(e=>e.fixedUpdate());
    }
    updateEntities(){
        this.entities.forEach(Lemon.updateObj);
        Lemon.animations.forEach(Lemon.updateObj);
    }
    updateGamepads(){
        for(let gp in Lemon.gamepads){
            Lemon.gamepads[gp].update();
        }
    }
    updateBodyList(){
        this.bodies=this.entities.filter(e=>e.is(Lemon.bodyTag));
    }
    loadTiledMap(map,props={}){
        this.attr({
            width:map.width*map.tilewidth,height:map.height*map.tileheight,
            tilewidth:map.tilewidth,tileheight:map.tileheight,
            layers:{},objects:[],name:map.name,map:map
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

        this.trapSize=0.4;
        this.tweens={};

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
    tween(property,to,time,method,evo,evp){
        this.tweens[property]?this.tweens[property].remove():0;
        this.tweens[property]=Lemon.tween(this,property,to,time,method,evo,evp).start();
        return this.tweens[property];
    }
    follow(ent,time="none"){
        
        if(time!=="none"){
            if(ent.x<this.leftInnerBoundary){
                //this.tween("x",ent.x-(this.width*(0.5-this.trapSize/2)),time,"decelerationCubed");
            }
            if(ent.y<this.topInnerBoundary){
                this.tween("y",ent.y-(this.height*(0.5-this.trapSize/2)),time,"decelerationCubed");
            }
            if(ent.x+ent.width>this.rightInnerBoundary){
                this.tween("x",ent.x+ent.width-(this.width*(0.5+this.trapSize/2)),time,"decelerationCubed");
            }
            if(ent.y+ent.height>this.bottomInnerBoundary){
                this.tween("y",ent.y+ent.height-(this.height*(0.5+this.trapSize/2)),time,"decelerationCubed");
            }
            if(this.x<0){this.x=0;}
            if(this.x>Lemon.currentScene.width-this.width){this.x=Lemon.currentScene.width-this.width;}
            if(this.y<0){this.y=0;}
            if(this.y>Lemon.currentScene.height-this.height){this.y=Lemon.currentScene.height-this.height;}
            return;
        }
        if(ent.x<this.leftInnerBoundary){
            this.x=ent.x-(this.width*(0.5-this.trapSize/2));
        }
        if(ent.y<this.topInnerBoundary){
            this.y=ent.y-(this.height*(0.5-this.trapSize/2));
        }
        if(ent.x+ent.width>this.rightInnerBoundary){
            this.x=ent.x+ent.width-(this.width*(0.5+this.trapSize/2));
        }
        if(ent.y+ent.height>this.bottomInnerBoundary){
            this.y=ent.y+ent.height-(this.height*(0.5+this.trapSize/2));
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
                this.sprite.x=0;
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
    rotate(center,angle){
        let r=[];
        let x=this.x-center.x;
        let y=this.y-center.y;

        r[0]=x*Math.cos(-angle)-y*Math.sin(-angle);
        r[1]=x*Math.sin(-angle)+y*Math.cos(-angle);
        r[0]+=center.x;
        r[1]+=center.y;

        return Lemon.vec(r[0],r[1]);   
    }
    add(vec){
        return Lemon.vec(this.x+vec.x,this.y+vec.y);
    }
    subtract(vec){
        return Lemon.vec(this.x-vec.y,this.y-vec.y);
    }
    scale(n){
        return Lemon.vec(this.x*n,this.y*n);
    }
    multiply(vec){
        return Lemon.vec(this.x*vec.x,this.y*vec.y);
    }
    cross(vec){
        return Lemon.vec(this.x*vec.y,this.y*vec.x);
    }
    normalize(){
        return Lemon.vec(this.x,this.y).setLength(1);
    }
    distance(vec){
        let x=this.x-vec.x;
        let y=this.y-vec.y;

        return Math.sqrt(x*x+y*y);
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
        x:0,y:0,minXV:-5,minYV:-5,maxXV:5,maxYV:5,maxSpeed:5,sprite:Lemon.rectangle(2,2,"grey"),lifetime:300,onupdate(){
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