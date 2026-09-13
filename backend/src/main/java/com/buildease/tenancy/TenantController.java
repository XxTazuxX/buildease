package com.buildease.tenancy;

import com.buildease.auth.Actor;
import com.buildease.security.Role;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class TenantController {
  private final TenantService service;

  public TenantController(TenantService service) {
    this.service = service;
  }

  public record Organization(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Email @Size(max = 254) String ownerEmail,
      @NotBlank @Size(max = 120) String ownerName,
      @Size(max = 256) String temporaryPassword) {}

  public record User(
      @NotBlank @Email @Size(max = 254) String email,
      @NotBlank @Size(max = 120) String name,
      @Size(max = 256) String temporaryPassword,
      boolean platformAdmin) {}

  public record Active(boolean active) {}

  public record Reset(@NotBlank @Size(max = 256) String temporaryPassword) {}

  public record Building(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,40}") String code) {}

  public record Invite(
      @NotBlank @Email @Size(max = 254) String email,
      @NotBlank @Size(max = 120) String name,
      @Size(max = 256) String temporaryPassword,
      boolean owner,
      UUID buildingId,
      @NotNull Set<Role> roles) {}

  public record Membership(boolean owner, boolean removed) {}

  public record Roles(@NotNull Set<Role> roles) {}

  @GetMapping("/platform/organizations")
  Object organizations(@RequestAttribute Actor actor, @RequestParam(defaultValue = "0") int page) {
    return service.organizations(actor, page);
  }

  @PostMapping("/platform/organizations")
  Object createOrg(@RequestAttribute Actor actor, @Valid @RequestBody Organization b) {
    return service.createOrganization(
        actor, b.name(), b.ownerEmail(), b.ownerName(), b.temporaryPassword());
  }

  @PatchMapping("/platform/organizations/{org}")
  void orgActive(@RequestAttribute Actor actor, @PathVariable UUID org, @RequestBody Active b) {
    service.organizationActive(actor, org, b.active());
  }

  @GetMapping("/platform/accounts")
  Object accounts(@RequestAttribute Actor actor, @RequestParam(defaultValue = "0") int page) {
    return service.accounts(actor, page);
  }

  @PostMapping("/platform/accounts")
  Object createAccount(@RequestAttribute Actor actor, @Valid @RequestBody User b) {
    return service.createAccount(
        actor, b.email(), b.name(), b.temporaryPassword(), b.platformAdmin());
  }

  @PatchMapping("/platform/accounts/{id}")
  void accountActive(@RequestAttribute Actor actor, @PathVariable UUID id, @RequestBody Active b) {
    service.accountStatus(actor, id, b.active());
  }

  @PostMapping("/platform/accounts/{id}/reset-password")
  void reset(@RequestAttribute Actor actor, @PathVariable UUID id, @Valid @RequestBody Reset b) {
    service.reset(actor, id, b.temporaryPassword());
  }

  @GetMapping("/organizations/{org}/access")
  Object access(@RequestAttribute Actor actor, @PathVariable UUID org) {
    return service.overview(actor, org);
  }

  @GetMapping("/organizations/{org}/buildings")
  Object buildings(
      @RequestAttribute Actor actor,
      @PathVariable UUID org,
      @RequestParam(defaultValue = "0") int page) {
    return service.buildings(actor, org, page);
  }

  @PostMapping("/organizations/{org}/buildings")
  Object building(
      @RequestAttribute Actor actor, @PathVariable UUID org, @Valid @RequestBody Building b) {
    return service.createBuilding(actor, org, b.name(), b.code());
  }

  @GetMapping("/organizations/{org}/members")
  Object members(
      @RequestAttribute Actor actor,
      @PathVariable UUID org,
      @RequestParam(required = false) UUID buildingId,
      @RequestParam(defaultValue = "0") int page) {
    return service.members(actor, org, buildingId, page);
  }

  @PostMapping("/organizations/{org}/members")
  Object invite(
      @RequestAttribute Actor actor, @PathVariable UUID org, @Valid @RequestBody Invite b) {
    return service.invite(
        actor,
        org,
        b.email(),
        b.name(),
        b.temporaryPassword(),
        b.owner(),
        b.buildingId(),
        b.roles());
  }

  @PatchMapping("/organizations/{org}/members/{user}")
  void member(
      @RequestAttribute Actor actor,
      @PathVariable UUID org,
      @PathVariable UUID user,
      @RequestBody Membership b) {
    service.membership(actor, org, user, b.owner(), b.removed());
  }

  @PostMapping("/organizations/{org}/invitations/accept")
  void accept(@RequestAttribute Actor actor, @PathVariable UUID org) {
    service.accept(actor, org);
  }

  @GetMapping("/organizations/{org}/buildings/{building}/members/{user}/roles")
  Object roles(
      @RequestAttribute Actor actor,
      @PathVariable UUID org,
      @PathVariable UUID building,
      @PathVariable UUID user) {
    return service.roles(actor, org, building, user);
  }

  @PutMapping("/organizations/{org}/buildings/{building}/members/{user}/roles")
  void roles(
      @RequestAttribute Actor actor,
      @PathVariable UUID org,
      @PathVariable UUID building,
      @PathVariable UUID user,
      @Valid @RequestBody Roles b) {
    service.replaceRoles(actor, org, building, user, b.roles());
  }

  @GetMapping("/organizations/{org}/audit")
  Object audit(
      @RequestAttribute Actor actor,
      @PathVariable UUID org,
      @RequestParam(defaultValue = "0") int page) {
    return service.audit(actor, org, page);
  }
}
