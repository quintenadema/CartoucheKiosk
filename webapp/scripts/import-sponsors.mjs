import { syncSponsorsFromClubSite } from "../src/lib/sponsor-sync.js";

const result = await syncSponsorsFromClubSite({ force: true });
console.log(JSON.stringify(result, null, 2));
