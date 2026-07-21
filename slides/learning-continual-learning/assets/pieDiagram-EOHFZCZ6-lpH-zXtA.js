import{p as et}from"./chunk-6ZKBGPIT-CuK62CZM.js";import{p as at}from"./cynefin-VYW2F7L2-VU6BHR45-BJIyaE_j.js";import{g as rt,s as it,a as nt,b as st,q as ot,p as lt,c as l,l as z,d as ct,E as dt,a3 as gt,a4 as pt,a5 as U,a6 as ht,f as ft,t as ut,a7 as mt,F as vt}from"./Mermaid.vue_vue_type_script_setup_true_lang-Mx8zB5wA.js";import"./index-CTU81Dmx.js";import"./modules/vue-D1X9l-ar.js";import"./modules/shiki-DDY7TlPV.js";import"./modules/file-saver-B7oFTzqn.js";var St=vt.pie,R={sections:new Map,showData:!1},T=R.sections,F=R.showData,xt=structuredClone(St),wt=l(()=>structuredClone(xt),"getConfig"),Ct=l(()=>{T=new Map,F=R.showData,ut()},"clear"),$t=l(({label:t,value:a})=>{if(a<0)throw new Error(`"${t}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);T.has(t)||(T.set(t,a),z.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),Dt=l(()=>T,"getSections"),yt=l(t=>{F=t},"setShowData"),Tt=l(()=>F,"getShowData"),q={getConfig:wt,clear:Ct,setDiagramTitle:lt,getDiagramTitle:ot,setAccTitle:st,getAccTitle:nt,setAccDescription:it,getAccDescription:rt,addSection:$t,getSections:Dt,setShowData:yt,getShowData:Tt},bt=l((t,a)=>{et(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),At={parse:l(async t=>{const a=await at("pie",t);z.debug(a),bt(a,q)},"parse")},_t=l(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieCircle.highlighted{
    scale: 1.05;
    opacity: 1;
  }
  .pieCircle.highlightedOnHover:hover{
    transition-duration: 250ms;
    scale: 1.05;
    opacity: 1;
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),kt=_t,Et=l(t=>{const a=[...t.values()].reduce((s,m)=>s+m,0),L=[...t.entries()].map(([s,m])=>({label:s,value:m})).filter(s=>s.value/a*100>=1);return mt().value(s=>s.value).sort(null)(L)},"createPieArcs"),zt=l((t,a,L,W)=>{var I;z.debug(`rendering pie chart
`+t);const s=W.db,m=ct(),h=dt(s.getConfig(),m.pie),H=40,i=18,c=4,C=450,S=C,b=gt(a),$=b.append("g");$.attr("transform","translate("+S/2+","+C/2+")");const{themeVariables:n}=m;let[M]=pt(n.pieOuterStrokeWidth);M??(M=2);const V=h.legendPosition,O=h.textPosition,X=h.donutHole>0&&h.donutHole<=.9?h.donutHole:0,f=Math.min(S,C)/2-H,Z=U().innerRadius(X*f).outerRadius(f),j=U().innerRadius(f*O).outerRadius(f*O),x=$.append("g");x.append("circle").attr("cx",0).attr("cy",0).attr("r",f+M/2).attr("class","pieOuterCircle");const D=s.getSections(),J=Et(D),K=[n.pie1,n.pie2,n.pie3,n.pie4,n.pie5,n.pie6,n.pie7,n.pie8,n.pie9,n.pie10,n.pie11,n.pie12];let A=0;D.forEach(e=>{A+=e});const P=J.filter(e=>(e.data.value/A*100).toFixed(0)!=="0"),_=ht(K).domain([...D.keys()]);x.selectAll("mySlices").data(P).enter().append("path").attr("d",Z).attr("fill",e=>_(e.data.label)).attr("class",e=>{let r="pieCircle";return h.highlightSlice==="hover"?r+=" highlightedOnHover":h.highlightSlice===e.data.label&&(r+=" highlighted"),r}),x.selectAll("mySlices").data(P).enter().append("text").text(e=>(e.data.value/A*100).toFixed(0)+"%").attr("transform",e=>"translate("+j.centroid(e)+")").style("text-anchor","middle").attr("class","slice");const Q=$.append("text").text(s.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText"),w=[...D.entries()].map(([e,r])=>({label:e,value:r})),u=$.selectAll(".legend").data(w).enter().append("g").attr("class","legend");u.append("rect").attr("width",i).attr("height",i).style("fill",e=>_(e.label)).style("stroke",e=>_(e.label)),u.append("text").attr("x",i+c).attr("y",i-c).text(e=>s.getShowData()?`${e.label} [${e.value}]`:e.label);const v=Math.max(...u.selectAll("text").nodes().map(e=>(e==null?void 0:e.getBoundingClientRect().width)??0));let y=C,k=S+H;const o=i+c,E=w.length*o;switch(V){case"center":u.attr("transform",(e,r)=>{const d=o*w.length/2,g=-v/2-(i+c),p=r*o-d;return"translate("+g+","+p+")"});break;case"top":y+=E,u.attr("transform",(e,r)=>{const d=f,g=-v/2-(i+c),p=r*o-d;return`translate(${g}, ${p})`}),x.attr("transform",()=>`translate(0, ${E+o})`);break;case"bottom":y+=E,u.attr("transform",(e,r)=>{const d=-f-o,g=-v/2-(i+c),p=r*o-d;return"translate("+g+","+p+")"});break;case"left":k+=i+c+v,u.attr("transform",(e,r)=>{const d=o*w.length/2,g=-f-(i+c),p=r*o-d;return"translate("+g+","+p+")"}),x.attr("transform",()=>`translate(${v+i+c}, 0)`);break;case"right":default:k+=i+c+v,u.attr("transform",(e,r)=>{const d=o*w.length/2,g=12*i,p=r*o-d;return"translate("+g+","+p+")"});break}const G=((I=Q.node())==null?void 0:I.getBoundingClientRect().width)??0,Y=S/2-G/2,tt=S/2+G/2,B=Math.min(0,Y),N=Math.max(k,tt)-B;b.attr("viewBox",`${B} 0 ${N} ${y}`),ft(b,y,N,h.useMaxWidth)},"draw"),Rt={draw:zt},Bt={parser:At,db:q,renderer:Rt,styles:kt};export{Bt as diagram};
