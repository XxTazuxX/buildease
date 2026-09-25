package com.buildease.reporting;

import com.buildease.auth.Actor;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

  @GetMapping("/occupancy")
  Object occupancy(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return service.occupancyReport(actor, organization, building);
  }

  @GetMapping("/maintenance")
  Object maintenance(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @RequestParam LocalDate from,
      @RequestParam LocalDate to) {
    return service.maintenanceReport(actor, organization, building, from, to);
  }

  @GetMapping(value = "/rent-roll/export", produces = "text/csv")
  ResponseEntity<String> rentRollCsv(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return csv(service.rentRollCsv(actor, organization, building), "rent-roll.csv");
  }

  @GetMapping(value = "/income-statement/export", produces = "text/csv")
  ResponseEntity<String> incomeStatementCsv(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @RequestParam LocalDate from,
      @RequestParam LocalDate to) {
    return csv(
        service.incomeStatementCsv(actor, organization, building, from, to),
        "income-statement.csv");
  }

  private ResponseEntity<String> csv(String body, String filename) {
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
        .contentType(MediaType.valueOf("text/csv"))
        .body(body);
  }
}
