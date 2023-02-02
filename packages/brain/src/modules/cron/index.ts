import { brainDb, signerApi, signerUrl, validatorApi } from "../../index.js";
import logger from "../logger/index.js";
import { StakingBrainDb } from "@stakingbrain/common";

// execute the reloadData async function every minute

/**
 * The cronjob must execute the follwing tasks:
 * - Delete validators from signer that are not in the db
 * - Delete validators from db that are not in the signer
 * - Add pubkeys and fee recipient to validator api that are in the db
 *
 * WARNING: What happens if there is no fee recipient for a given validator? default?
 */
export async function reloadData(): Promise<void> {
  try {
    // 1. Read DB (pubkeys, fee recipients, tags)
    // TODO: add test
    brainDb.read();
    if (!brainDb.data) logger.warn(`[Cron] Database is empty`);
    // 2. GET signer API pubkeys
    // TODO: add test
    const signerPubkeys = (await signerApi.getKeystores()).data.map(
      (keystore) => keystore.validating_pubkey
    );
    // 3. GET validator API pubkeys and fee recipients
    // TODO: add test
    const validatorPubkeysFeeRecipients = new Map();
    const validatorPubkeys =
      (await validatorApi.getRemoteKeys()).data.map(
        (keystore) => keystore.pubkey
      ) || [];
    for (const pubkey of validatorPubkeys) {
      const feeRecipient = await validatorApi.getFeeRecipient(pubkey);
      validatorPubkeysFeeRecipients.set(pubkey, feeRecipient);
    }
    // 4. DELETE from signer API pubkeys that are not in DB
    // TODO: add test
    const signerPubkeysToRemove = signerPubkeys.filter(
      (pubkey) => !(brainDb.data as StakingBrainDb)[pubkey]
    );
    if (signerPubkeysToRemove.length > 0) {
      logger.debug(
        `[Cron] Found ${signerPubkeysToRemove.length} validators to remove from signer`
      );
      await signerApi.deleteKeystores({ pubkeys: signerPubkeysToRemove });
      logger.debug(
        `[Cron] Deleted ${signerPubkeysToRemove.length} validators from signer`
      );
    }
    // 5. DELETE from DB pubkeys that are not in signer API
    // TODO: add test
    const brainDbPubkeysToRemove = Object.keys(
      brainDb.data as StakingBrainDb
    ).filter((pubkey) => !signerPubkeys.includes(pubkey));
    if (brainDbPubkeysToRemove.length > 0) {
      logger.debug(
        `[Cron] Found ${brainDbPubkeysToRemove.length} validators to remove from DB`
      );
      brainDb.deletePubkeys(brainDbPubkeysToRemove);
      logger.debug(
        `[Cron] Deleted ${brainDbPubkeysToRemove.length} validators from DB`
      );
    }
    // 6. POST to validator API pubkeys that are in DB and not in validator API
    // TODO: add test
    const brainDbPubkeysToAdd = Object.keys(
      brainDb.data as StakingBrainDb
    ).filter((pubkey) => !validatorPubkeys.includes(pubkey));
    if (brainDbPubkeysToAdd.length > 0) {
      logger.debug(
        `[Cron] Found ${brainDbPubkeysToAdd.length} validators to add to validator API`
      );
      await validatorApi.postRemoteKeys({
        remote_keys: brainDbPubkeysToAdd.map((pubkey) => ({
          pubkey,
          url: signerUrl,
        })),
      });
      logger.debug(
        `[Cron] Added ${brainDbPubkeysToAdd.length} validators to validator API`
      );
    }
    // 7. DELETE to validator API pubkeys that are in validator API and not in DB
    // TODO: add test
    const validatorPubkeysToRemove = validatorPubkeys.filter(
      (pubkey) => !(brainDb.data as StakingBrainDb)[pubkey]
    );
    if (validatorPubkeysToRemove.length > 0) {
      logger.debug(
        `[Cron] Found ${validatorPubkeysToRemove.length} validators to remove from validator API`
      );
      await validatorApi.deleteRemoteKeys({
        pubkeys: validatorPubkeysToRemove,
      });
      logger.debug(
        `[Cron] Removed ${validatorPubkeysToRemove.length} validators from validator API`
      );
    }
    // 8. POST to validator API fee recipients that are in DB and not in validator API
    // TODO: add test
    const brainDbPubkeysFeeRecipientsToAdd = Array.from(
      validatorPubkeysFeeRecipients.entries()
    ).filter(
      ([pubkey, feeRecipient]) =>
        (brainDb.data as StakingBrainDb)[pubkey] &&
        (brainDb.data as StakingBrainDb)[pubkey].feeRecipient !== feeRecipient
    );
    if (brainDbPubkeysFeeRecipientsToAdd.length > 0) {
      logger.debug(
        `[Cron] Found ${brainDbPubkeysFeeRecipientsToAdd.length} validators to add to validator API`
      );
      for (const [pubkey, feeRecipient] of brainDbPubkeysFeeRecipientsToAdd) {
        await validatorApi.setFeeRecipient(feeRecipient, pubkey);
      }
      logger.debug(
        `[Cron] Added ${brainDbPubkeysFeeRecipientsToAdd.length} validators to validator API`
      );
    }
  } catch (e) {
    logger.error(`[Cron] reloading data`, e);
    // TODO: handle all possible errors:
    /**
     * ERROR PKG not installed (addr not found)
      ```
      Error: getaddrinfo ENOTFOUND validator.lighthouse-prater.dappnode
        at GetAddrInfoReqWrap.onlookup [as oncomplete] (node:dns:107:26) {
        errno: -3008,
        code: 'ENOTFOUND',
        syscall: 'getaddrinfo',
        hostname: 'validator.lighthouse-prater.dappnode'
        }
       ```

      * ERROR brain host not authorized
       ```
       { message: 'Host not authorized.' }
       ```
     */
  }
}
