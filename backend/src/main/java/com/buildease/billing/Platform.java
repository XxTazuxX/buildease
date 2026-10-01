package com.buildease.billing;

import com.buildease.auth.Actor;
import com.buildease.common.*;

/** Platform-operator guard shared by the billing services (mirrors other platform services). */
final class Platform {
  private Platform() {}

  static void require(Store db, Actor actor) {
    if (!actor.admin()
        || db.find("select 1 from accounts where id=? and active and platform_admin", actor.id())
            .isEmpty()) throw ApiException.forbidden();
    db.context(actor.id(), null, actor.impersonatedBy());
  }
}
