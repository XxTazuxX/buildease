package com.buildease.notification;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.buildease.auth.Actor;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class NotificationServiceTest {
  final Actor actor = new Actor(UUID.randomUUID(), UUID.randomUUID(), false, false);

  @Test
  void webPushConfigurationRequiresAPublicKey() {
    NotificationService unconfigured = new NotificationService(mock(Store.class), "");
    assertThatThrownBy(unconfigured::webPushConfiguration)
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(503));

    NotificationService configured = new NotificationService(mock(Store.class), "public-key");
    assertThat(configured.webPushConfiguration()).containsEntry("publicKey", "public-key");
  }

  @Test
  void inboxRejectsOutOfRangePages() {
    NotificationService service = new NotificationService(mock(Store.class), "");
    assertThatThrownBy(() -> service.inbox(actor, false, -1))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(400));
    assertThatThrownBy(() -> service.inbox(actor, false, 10001))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(400));
  }

  @Test
  void markingAnUnknownNotificationAsReadFails() {
    Store db = mock(Store.class);
    when(db.update(anyString(), any(UUID.class), any(UUID.class))).thenReturn(0);
    NotificationService service = new NotificationService(db, "");
    UUID notification = UUID.randomUUID();
    assertThatThrownBy(() -> service.read(actor, notification))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(404));
  }
}
