import{c as p}from"./index-ImOX36js.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]],q=p("circle-check-big",A);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]],L=p("credit-card",v);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=[["polygon",{points:"3 11 22 2 13 21 11 13 3 11",key:"1ltx0t"}]],B=p("navigation",z);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]],D=p("printer",M);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const V=[["rect",{width:"14",height:"20",x:"5",y:"2",rx:"2",ry:"2",key:"1yt0o3"}],["path",{d:"M12 18h.01",key:"mhygvu"}]],U=p("smartphone",V);/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */const i=[{id:"standard",name:"Standard Rate (16% VAT)",status:"taxable",ratePercent:16,description:"Standard Value Added Tax (VAT 16%)"},{id:"reduced",name:"Reduced Rate (8% VAT)",status:"taxable",ratePercent:8,description:"Reduced VAT rate for specialized goods & services (8%)"},{id:"zero_rated",name:"Zero-Rated (0% VAT)",status:"zero_rated",ratePercent:0,description:"Exports & essential items (0% VAT)"},{id:"exempt",name:"Tax Exempt (0%)",status:"exempt",ratePercent:0,description:"Exempt items e.g., medical, education, uncollected tax"}];function S(t){if(!t)return i[0];const a=i.find(e=>e.id===t);return a||(t==="A"||t==="standard"?i[0]:t==="B"||t==="reduced"?i[1]:t==="C"||t==="zero_rated"?i[2]:t==="E"||t==="exempt"?i[3]:i[0])}function w(t){let a=t.taxStatus||"taxable",e=typeof t.taxRate=="number"?t.taxRate:16,r=t.taxClass||"standard";if(t.taxClass){const o=S(t.taxClass);a=o.status,e=o.ratePercent,r=o.id}else if(t.taxId){const o=S(t.taxId);a=o.status,e=o.ratePercent,r=o.id}else t.taxStatus&&(a=t.taxStatus,(a==="zero_rated"||a==="exempt")&&(e=0));return(a==="zero_rated"||a==="exempt")&&(e=0),{taxStatus:a,taxRate:e,taxClass:r}}function F(t,a=0,e=0,r="exempt",o=0){const c=t.reduce((n,T)=>n+(T.price??T.product.price)*T.quantity,0);let l=0,f=0,h=0,C=0,y=0,_=0;const $=t.map(n=>{const s=(n.price??n.product.price)*n.quantity,k=c>0?a*s/c:0,x=Math.max(0,s-k),{taxStatus:b,taxRate:g,taxClass:E}=w(n.product);let u=0,d=x;return b==="taxable"&&g>0?(l+=s,d=x/(1+g/100),u=x-d,f+=d):b==="zero_rated"?(h+=s,u=0,d=x):(C+=s,u=0,d=x),_+=d,y+=u,{lineSubtotal:s,lineDiscount:k,effectiveSubtotal:x,taxStatus:b,taxRate:g,taxClass:E,lineTax:u}}),m=r==="taxable"?e*(o/100):0,P=y+m,R=Math.max(0,c-a)+e+m;return{cartSubtotal:c,subtotalExclTax:_,discountTotal:a,taxableSubtotal:l,taxableSubtotalExclTax:f,zeroRatedSubtotal:h,exemptSubtotal:C,cartTax:y,shippingFee:e,shippingTaxStatus:r,shippingTaxRate:o,shippingTax:m,totalTax:P,cartTotal:R,lineCalculations:$}}function Z(){const e=F([{product:{id:"test-taxable",sku:"TAX-001",name:"Taxable Coffee Beans",description:"",price:100,category:"Food",tags:[],type:"physical",imageUrl:"",stock:10,rating:5,reviewsCount:0,reviews:[],taxStatus:"taxable",taxRate:16,taxClass:"standard"},quantity:1,price:100},{product:{id:"test-zero",sku:"ZERO-001",name:"Zero-Rated Export Tea",description:"",price:100,category:"Food",tags:[],type:"physical",imageUrl:"",stock:10,rating:5,reviewsCount:0,reviews:[],taxStatus:"zero_rated",taxRate:0,taxClass:"zero_rated"},quantity:1,price:100}],0,0),c=100-100/1.16+0,l=200;return Math.abs(e.cartTax-c)<1e-4&&Math.abs(e.cartTotal-l)<1e-4?{success:!0,message:`[Validation Test Passed] Mixed cart (Taxable $100 @ 16% incl. + Zero-Rated $100 @ 0%) produced price excl. tax of $${e.subtotalExclTax.toFixed(2)} + VAT $${e.cartTax.toFixed(2)} = cartTotal of exactly $${e.cartTotal.toFixed(2)}.`,details:e}:{success:!1,message:`[Validation Test Failed] Expected cart_total $${l.toFixed(2)} & tax $${c.toFixed(2)}, got total $${e.cartTotal.toFixed(2)} & tax $${e.cartTax.toFixed(2)}.`,details:e}}if(typeof window<"u"){const t=Z();console.log("✅ Tax Calculation Validation:",t.message)}export{q as C,i as D,B as N,D as P,U as S,L as a,S as b,F as c,w as g,Z as r};
