package com.buildease.reporting;

import com.buildease.auth.Actor;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}/reports")
public class ReportingController {
  private final ReportingService service;

  public ReportingController(ReportingService service) {
    this.service = service;
  }

  @GetMapping("/rent-roll")
  Object rentRoll(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return service.rentRoll(actor, organization, building);
  }

  @GetMapping("/income-statement")
  Object incomeStatement(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @RequestParam LocalDate from,
      @RequestParam LocalDate to) {
    return service.incomeStatement(actor, organization, building, from, to);
  }

  @GetMapping("/leases/{lease}/statement")
  Object leaseStatement(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease,
      @RequestParam LocalDate from,
      @RequestParam LocalDate to) {
    return service.leaseStatement(actor, organization, building, lease, from, to);
  }
}
