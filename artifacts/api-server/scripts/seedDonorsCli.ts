import { seedDonors } from "./seedDonors";

seedDonors()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
