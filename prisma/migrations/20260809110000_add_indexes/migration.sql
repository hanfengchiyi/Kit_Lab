-- 查询性能索引：公共工具按分类展示、按属主查询、收藏按工具聚合
CREATE INDEX "Tool_category_visibility_idx" ON "Tool"("category", "visibility");
CREATE INDEX "Tool_ownerId_idx" ON "Tool"("ownerId");
CREATE INDEX "Favorite_toolId_idx" ON "Favorite"("toolId");
