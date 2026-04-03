import{_ as c,a as m,b as g,c as p}from"./modules/unplugin-icons-CcJ6vSwS.js";import{o as h,b as f,w as y,g as e,j as _,D as n,d as i,v as w,x as b,z as o}from"./modules/vue-tOaAuCXo.js";import{I as v}from"./slidev/default-B0uuYqKV.js";import{u as k,f as x}from"./slidev/context-Db2CFZ9A.js";import"./index-hZ_7ZqxO.js";import"./modules/shiki-6pP-d7XW.js";const A="/slides/sdft/images/s11-linkedin-qr.png",T={class:"grid grid-cols-[1fr_auto] gap-6 text-xs"},D={class:"flex flex-col items-center gap-2"},I={class:"flex gap-3 items-center text-lg"},E={__name:"11-closing.md__slidev_40",setup(O){const{$clicksContext:s,$frontmatter:a}=k();return s.setup(),(S,t)=>{const l=c,r=m,u=g,d=p;return h(),f(v,w(b(o(x)(o(a),39))),{default:y(()=>[t[3]||(t[3]=e("h1",null,"Q&A",-1)),_(`
SPEAKING:
- "Thank you for your attention! I'm happy to take questions."
- "Before we open up — three key takeaways from today:"
- "One: On-policy distillation combines the best of SFT (dense signal) and RL (right distribution), giving 10-100x efficiency gains."
- "Two: Self-distillation via privileged information means you don't need a separate larger teacher — the model teaches itself."
- "Three: SDFT demonstrates this enables genuine continual learning — skills accumulate without catastrophic forgetting."
- "I'm also open to research collaborations if any of these topics interest you."

Q&A MANAGEMENT:
- If no questions come immediately, seed with: "One question I often get is: if this is so powerful, why isn't everyone using it already? The answer is that it's brand new — January 2026 — and the engineering infrastructure for on-policy training at scale is still being built."
- For questions you're unsure about, it's fine to say "That's a great question, I'd need to think more about it. Let's discuss after the session."

PREPARED ANSWERS FOR COMMON END-OF-TALK QUESTIONS:

Q: What's the single most important contribution of this paper?
A: The demonstration that on-policy self-distillation enables continual learning. The method is elegant, but the result — that models can accumulate skills across domains without forgetting — is the breakthrough. Previous work showed on-policy distillation is more efficient; SDFT showed it's also the key to continual learning.

Q: How would you improve SDFT if you were the authors?
A: Three directions: (1) Scale the continual learning experiment beyond 3 tasks to validate at real scale. (2) Test with multi-turn tasks using pi-Distill's framework. (3) Combine multiple PI sources (demonstrations + environment feedback + user corrections) for richer supervision.

Q: What's the relationship to test-time compute / inference-time scaling?
A: Complementary. Test-time compute (chain-of-thought, tree search) improves the model at inference without changing weights. Self-OPD improves the model's weights from experience. You could combine both: use extended inference to generate high-quality rollouts, then distill those improved behaviors into the weights via SDFT.

Q: Is this the end of RLHF?
A: Not likely. RLHF serves a specific purpose — alignment with human preferences — that OPD doesn't directly address. OPD is primarily for capability acquisition and knowledge transfer. However, the dense-signal advantage of OPD might eventually be adapted for alignment (SDPO already moves in this direction).

Q: Could this approach work for multimodal models?
A: In principle, yes. The framework is general — you need on-policy generation and a teacher with privileged information. For vision-language models, the PI could be the original image (student gets only text description), or detailed image annotations. No paper has explored this yet — could be a good research direction.
`),t[4]||(t[4]=e("div",{class:"text-sm p-3 bg-blue-50 rounded-lg mb-4"},[e("p",null,[e("strong",null,"Key takeaways")]),e("ol",null,[e("li",null,[e("strong",null,"OPD"),n(" = on-policy + dense signal → 10–100× more efficient than RL")]),e("li",null,[e("strong",null,"Self-distillation"),n(" via privileged information — no larger teacher needed")]),e("li",null,[e("strong",null,"SDFT"),n(" enables continual learning — skills accumulate without forgetting")])])],-1)),e("div",T,[t[2]||(t[2]=e("div",{class:"space-y-2"},[e("p",null,[e("strong",null,"Open to research collaborations — let’s connect!")]),e("p",null,[e("strong",null,"Research interests:"),n(" Agentic AI · Continual Learning · Multi-modal Models · ARC-AGI")]),e("p",null,[e("strong",null,"Ongoing research:"),n(" OPD extensions · DocVQA · ARC-AGI 3")])],-1)),e("div",D,[t[0]||(t[0]=e("img",{src:A,class:"w-36 rounded",alt:"LinkedIn QR"},null,-1)),e("div",I,[i(l,{class:"text-[#0A66C2]"}),i(r,{class:"text-[#333]"}),i(u,{class:"text-[#1DA1F2]"}),i(d,{class:"text-[#EA4335]"})]),t[1]||(t[1]=e("p",null,[e("strong",null,"@bdsaglam")],-1))])])]),_:1},16)}}};export{E as default};
