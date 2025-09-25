// Author: Created by FabriceNeyret2 in 2017-04-03
// Title: maze worms / graffitis 3b @ shadertoy
// 20200624_glsl Particle_v5A(曲線圖).qtz


#ifdef GL_ES
precision mediump float;
#endif

#if defined( BUFFER_0 )
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

float iTime=u_time;                       //更改 shadertoy->glsl editor  
vec2 iResolution=u_resolution;            //更改 shadertoy->glsl editor 
vec2 iMouse=u_mouse.xy;                   //更改 shadertoy->glsl editor
uniform sampler2D u_buffer0;
uniform sampler2D u_tex0;                 //更改  Target DensityMap
uniform sampler2D u_tex1;                 //更改  Target MotionMap
uniform sampler2D u_tex2;


#define CS(a)  vec2(cos(a),sin(a))
#define rnd(x) ( 2.* fract(456.68*sin(1e3*x+mod(iDate.w,100.))) -1.) // NB: mod(t,1.) for less packed pattern //亂數範圍 [-1,1]
#define T(U) texture2D(u_buffer0, (U)/R)  //FBO，持續更新粒子狀態
#define D(U) texture2D(u_tex1, (U)/R)  //初始照片，以Density作為
#define M(U) texture2D(u_tex1, (U)/R)  //初始照片，以MotionMap作為


float glow(float d, float str, float thickness){
    return thickness / pow(d, str);
}
vec2 hash2( vec2 x )            //亂數範圍 [-1,1]
{
    const vec2 k = vec2( 0.3183099, 0.3678794 );
    x = x*k + k.yx;
    return -1.0 + 2.0*fract( 16.0 * k*fract( x.x*x.y*(x.x+x.y)) );
}

float gnoise( in vec2 p )       //亂數範圍 [-1,1]
{
    vec2 i = floor( p );
    vec2 f = fract( p );
    
    vec2 u = f*f*(3.0-2.0*f);

    return mix( mix( dot( hash2( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ), 
                            dot( hash2( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                         mix( dot( hash2( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ), 
                            dot( hash2( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
}

//Randomness code from Martin, here: https://www.shadertoy.com/view/XlfGDS
float Random_Final(vec2 uv, float seed)         //亂數範圍 [-1,1]
{
    float fixedSeed = abs(seed) + 1.0;
    float x = dot(uv, vec2(12.9898,78.233) * fixedSeed);
    return 2.*fract(sin(x) * 43758.5453)-1.;
}


/////////////////////////////////
const float r = 1.5, N = 200.; // width , number of worms

void main()
{
    vec4 iDate= vec4(iTime);
    vec2 U = gl_FragCoord.xy;       //input 
    vec2 R = iResolution.xy;
    vec4 O;                         //output
    
    if (T(R).x==0.) { U = abs(U/R*2.-1.); O  = vec4(max(U.x,U.y)>1.-r/R.y); O.w=0.; gl_FragColor=O; return;} // track window resize

//--STEP1.--------
    // 1st column store worms state.
    if (U.y==.5 && T(U).w==0.) {                           // initialize heads state: P, a, t
        O = vec4( R/2. + R/2.4* vec2(Random_Final(U.xy, iTime),Random_Final(U.xy, iTime+1.11)) , 3.14 * rnd(U.x+.2), 1); //範圍[800x600]
        
        if (D(O.xy).g<0.35) O.w = 0.;               // initial condition, too dark then death
        gl_FragColor=O; return;
    } 
    
//--STEP2.--------
    // Other columns do the drawing.
    O = T(U);           //attention O是color data(yes)還是position data(no)
    //Drawing! 
    //讀取第一列由左至右的粒子資訊P,若P.w粒子生存,以length(P.xy-U)著色, P的資訊以座標系統是以pixel為單位
    for (float x=.5; x<=N; x++) {                          // --- draw heads

        vec4 P = T(vec2(x,.5));                            // head state: P, a, t 
        
        //畫法一 若有乘以P.w，畫筆隨粒子生命增長而變淡
        if (P.w>0.) O += smoothstep(r,0., length(P.xy-U))  // draw head if active
                         *(.4)*(exp(-0.005*P.w))*vec4(0.9, 0.4, 0.1, 0.2);      // coloring scheme (exp(-0.02*P.w))
        //畫法二 持續累加
        //if (P.w>0.) O += glow(length( (P.xy-U)/R ), 1.4, 0.0005)*(0.001)*vec4(0.9, 0.4, 0.1, 0.2);        
    }

//--STEP3.--------
    //U以整數pixel為單位，需注意特殊用法，第一列為0.5，第二列為1.5
    if (U.y==.5) {                                         // --- head programms: worm strategy
           //讀取第一列粒子狀態指定為P，P.xy表示position, P.z儲存粒子差異化亂數, P.w表示粒子active
        vec4 P = T(U);                                     // head state: P, a, t 
        if (P.w>0.) {                                      // if active
            float a = P.z;                             // a=每個粒子旋轉角度 per particle
            a+=6.1/P.w;                                //值大曲度大：4.0初始圈數多,2.0螺旋,0.5小勾,0.1直線 
            a+=0.01;
            
            //Taget Image作用。待處理           
            vec2 V = (-1.0)*M(P.xy).xy;             //讀取MotionMap資訊的RG色版，分別代表XY軸速度
            float D = D(P.xy).g+(0.0*rnd(iTime));       //讀取DensityMap資訊的G色版
            //，加上亂數有關鍵性影響!
          
            //float rot=atan(V.x, V.y);
           //float area=smoothstep(0.05, 0.15, length(V.xy));
            
            //vec2 newPos= P.xy+ 0.1*V.xy+ 1.*CS(3.28*gnoise(0.1*P.xy));  //target image
            //vec2 newPos= P.xy+ 0.5*V.xy+ 1.*CS(3.28*gnoise(1.01*P.xy));  //target image
            vec2 newPos= P.xy+ CS(a);                         //parametric
            //vec2 newPos= P.xy+ 4.0*CS(3.14 * rnd(U.x));   //random walk
            //vec2 newPos= P.xy+ CS(3.14*gnoise(0.05*P.xy));//perlin noise
            //vec2 newPos= P.xy+ CS(3.14*gnoise(0.05*P.xy))+ 2.0*CS(3.14 * rnd(U.x));//perlin noise+random
      
            O = vec4(newPos,mod(a,6.2832),P.w+1.);         // move head, P.w儲存每個粒子的生命age
            
            //設定死亡條件
            if  ( O.x<0.|| O.x>R.x || O.y<0.|| O.y>R.y )  { O.w = 0.;} // 若超過邊界，生命age歸零
            if  ( T(P.xy+(r+2.)*CS(a)).w > 0.2 )  { O.w = 0.;} // 若碰撞其它粒子，生命age歸零            
            //if ( length(V)<0.01 ) { O.w = 0.; V=vec2(0.0);} //速度過小，生命age歸零
            if ( D< 0.45) { O.w = 0.;}                //判定初始位置若過於明亮，生命age歸零   
        }
    }
    
   
  //if (iMouse.w > 0. && distance(iMouse.xy, U) < 50.) O = vec4(0.); // painting
  //O.w=1.0;    //需注意parametric模式會導致靜止不動
  gl_FragColor=O;
}
