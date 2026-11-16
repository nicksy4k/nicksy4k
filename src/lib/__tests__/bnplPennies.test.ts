import {expect,test} from "vitest";
import {bnplRemaining,bnplCoveredCount} from "@/lib/outgoings";
const d={id:"a",total_amount:100,installments_total:3,payments:[{amount:33.33},{amount:33.33},{amount:33.33}]} as any;
test("settles",()=>{expect(bnplRemaining(d)).toBe(0);expect(bnplCoveredCount(d,3)).toBe(3);
expect(bnplCoveredCount({...d,payments:d.payments.slice(0,2)},3)).toBe(2);
expect(bnplRemaining({...d,payments:d.payments.slice(0,2)})).toBe(33.34);});
