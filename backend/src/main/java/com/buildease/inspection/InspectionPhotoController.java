package com.buildease.inspection;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(
    "/api/organizations/{organization}/buildings/{building}/inspections/{inspection}/photos")
public class InspectionPhotoController {
  private final InspectionPhotoService service;

  public InspectionPhotoController(InspectionPhotoService service) {
    this.service = service;
  }

  public record Upload(@NotBlank String contentType, @Min(1) @Max(10485760) long sizeBytes) {}

  @PostMapping("/upload")
  Object upload(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID inspection,
      @Valid @RequestBody Upload body) {
    return service.prepare(
        actor, organization, building, inspection, body.contentType(), body.sizeBytes());
  }

  @GetMapping("/{photo}/download")
  Object download(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID inspection,
      @PathVariable UUID photo) {
    return service.download(actor, organization, building, inspection, photo);
  }
}
