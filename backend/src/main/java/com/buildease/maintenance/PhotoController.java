package com.buildease.maintenance;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(
    "/api/organizations/{organization}/buildings/{building}/maintenance/requests/{request}/photos")
public class PhotoController {
  private final PhotoService service;

  public PhotoController(PhotoService service) {
    this.service = service;
  }

  public record Upload(@NotBlank String contentType, @Min(1) @Max(10485760) long sizeBytes) {}

  @PostMapping("/upload")
  Object upload(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID request,
      @Valid @RequestBody Upload body) {
    return service.prepare(
        actor, organization, building, request, body.contentType(), body.sizeBytes());
  }

  @GetMapping("/{photo}/download")
  Object download(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID request,
      @PathVariable UUID photo) {
    return service.download(actor, organization, building, request, photo);
  }
}
