package com.buildease.inspection;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.net.URI;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.*;

@Service
@Transactional
public class InspectionPhotoService {
  private static final Set<String> CONTENT_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
  private final Store db;
  private final InspectionService inspections;
  private final String bucket;
  private final String region;
  private final String endpoint;
  private final boolean pathStyle;

  public InspectionPhotoService(
      Store db,
      InspectionService inspections,
      @Value("${app.object-storage-bucket:}") String bucket,
      @Value("${app.object-storage-region:us-east-1}") String region,
      @Value("${app.object-storage-endpoint:}") String endpoint,
      @Value("${app.object-storage-path-style:true}") boolean pathStyle) {
    this.db = db;
    this.inspections = inspections;
    this.bucket = bucket;
    this.region = region;
    this.endpoint = endpoint;
    this.pathStyle = pathStyle;
  }

  public Map<String, Object> prepare(
      Actor actor,
      UUID organization,
      UUID building,
      UUID inspection,
      String contentType,
      long size) {
    inspections.requireManagerForPhotos(actor, organization, building, inspection);
    if (!CONTENT_TYPES.contains(contentType))
      throw new ApiException(400, "Only JPEG, PNG, and WebP photos are supported");
    if (size < 1 || size > 10 * 1024 * 1024)
      throw new ApiException(400, "Photo must be 10 MB or smaller");
    configured();
    UUID photo = UUID.randomUUID();
    String key = organization + "/" + building + "/inspections/" + inspection + "/" + photo;
    var put =
        PutObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .contentType(contentType)
            .contentLength(size)
            .build();
    String url;
    try (S3Presigner presigner = presigner()) {
      url =
          presigner
              .presignPutObject(
                  PutObjectPresignRequest.builder()
                      .signatureDuration(Duration.ofMinutes(10))
                      .putObjectRequest(put)
                      .build())
              .url()
              .toString();
    }
    db.update(
        "insert into inspection_photos(id,organization_id,building_id,inspection_id,uploaded_by,object_key,content_type,size_bytes) values (?,?,?,?,?,?,?,?)",
        photo,
        organization,
        building,
        inspection,
        actor.id(),
        key,
        contentType,
        size);
    db.audit(actor.id(), organization, "INSPECTION_PHOTO_PREPARED", photo);
    return Map.of("id", photo, "uploadUrl", url, "contentType", contentType);
  }

  public Map<String, String> download(
      Actor actor, UUID organization, UUID building, UUID inspection, UUID photo) {
    inspections.detail(actor, organization, building, inspection);
    configured();
    var row =
        db.one(
            "select object_key from inspection_photos where organization_id=? and building_id=? and inspection_id=? and id=?",
            organization,
            building,
            inspection,
            photo);
    var get =
        GetObjectRequest.builder().bucket(bucket).key(row.get("object_key").toString()).build();
    try (S3Presigner presigner = presigner()) {
      return Map.of(
          "url",
          presigner
              .presignGetObject(
                  GetObjectPresignRequest.builder()
                      .signatureDuration(Duration.ofMinutes(5))
                      .getObjectRequest(get)
                      .build())
              .url()
              .toString());
    }
  }

  private void configured() {
    if (bucket.isBlank()) throw new ApiException(503, "Photo storage is not configured");
  }

  private S3Presigner presigner() {
    var builder =
        S3Presigner.builder()
            .region(Region.of(region))
            .credentialsProvider(DefaultCredentialsProvider.create())
            .serviceConfiguration(
                S3Configuration.builder().pathStyleAccessEnabled(pathStyle).build());
    if (!endpoint.isBlank()) builder.endpointOverride(URI.create(endpoint));
    return builder.build();
  }
}
